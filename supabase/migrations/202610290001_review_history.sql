-- T7 adds immutable review lineage. Existing approval remains the only official writer.
alter table public.proposals drop constraint proposals_generation_check;
alter table public.proposals add constraint proposals_generation_check check(generation between 1 and 100);
alter table public.proposals add column parent_proposal_id uuid;
alter table public.proposals add column restores_revision_id uuid;
alter table public.proposals add column review_assertions jsonb not null default '{}';
alter table public.proposals add foreign key(workspace_id,event_id,parent_proposal_id) references public.proposals(workspace_id,event_id,id);
alter table public.proposals add foreign key(workspace_id,event_id,restores_revision_id) references public.revisions(workspace_id,event_id,id);
create unique index one_proposal_successor on public.proposals(parent_proposal_id) where parent_proposal_id is not null;
alter table public.revisions add column restores_revision_id uuid;
alter table public.revisions add foreign key(workspace_id,event_id,restores_revision_id) references public.revisions(workspace_id,event_id,id);
create function eventops_private.revision_restore_origin() returns trigger language plpgsql set search_path='' as $$
begin
 new.restores_revision_id:=(select restores_revision_id from public.proposals where id=new.proposal_id and event_id=new.event_id and workspace_id=new.workspace_id);
 return new;
end $$;
create trigger revision_restore_origin before insert on public.revisions for each row execute function eventops_private.revision_restore_origin();

create table public.review_answers(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,job_id uuid not null,draft_id uuid not null,
 question_index integer not null,question text not null,answer_json jsonb not null,source_record_id uuid not null,actor uuid not null references public.profiles(user_id),
 draft_generation integer not null,create_key uuid not null,request_digest text not null,receipt jsonb not null,created_at timestamptz not null default now(),
 unique(event_id,create_key),foreign key(workspace_id,event_id,job_id) references public.analysis_jobs(workspace_id,event_id,id),
 foreign key(workspace_id,event_id,draft_id) references public.text_update_drafts(workspace_id,event_id,id),
 foreign key(workspace_id,event_id,source_record_id) references public.source_records(workspace_id,event_id,id)
);
alter table public.review_answers enable row level security;
revoke all on public.review_answers from public,anon,authenticated;
grant select on public.review_answers to authenticated;
create policy own_records on public.review_answers for select to authenticated using(workspace_id in(select id from public.workspaces) and event_id in(select id from public.events));
create trigger immutable_record before update on public.review_answers for each row execute function eventops_private.immutable_record();

create function public.answer_analysis(p_event_id uuid,p_job_id uuid,p_result_digest text,p_generation integer,p_question integer,p_answer text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.analysis_jobs;d public.text_update_drafts;a public.review_answers;request text;q text;txt text;artifact uuid;source uuid;receipt jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_key is null or p_answer is null or length(btrim(p_answer)) not between 1 and 2000 or p_question is null then raise sqlstate '22023' using message='Answer required';end if;
 request:=eventops_private.hash(jsonb_build_object('job',p_job_id,'digest',p_result_digest,'generation',p_generation,'question',p_question,'answer',p_answer));
 select * into a from public.review_answers where event_id=ev.id and create_key=p_key;
 if found then if a.request_digest<>request then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return a.receipt;end if;
 select * into j from public.analysis_jobs where id=p_job_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Analysis not found';end if;
 if j.state<>'completed' or j.result_digest is distinct from p_result_digest or ev.current_revision_id is distinct from j.base_revision_id then raise sqlstate 'P0001' using message='Stale plan';end if;
 if p_question<0 or p_question>=jsonb_array_length(j.result->'questions') then raise sqlstate '22023' using message='Unknown question';end if;
 q:=j.result->'questions'->>p_question;
 select * into d from public.text_update_drafts where id=j.draft_id for update;
 if d.generation is distinct from p_generation then raise sqlstate 'P0001' using message='Draft changed';end if;
 txt:=d.corrected_text||E'\n\nClarification for: '||q||E'\nOrganizer answer: '||p_answer;
 if length(txt)>10000 then raise sqlstate '22023' using message='Clarified text too long';end if;
 receipt:=public.save_text_update(ev.id,d.raw_text,txt,p_key,d.id,d.generation);
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',eventops_private.hash(to_jsonb(p_answer)),auth.uid(),jsonb_build_object('kind','organizer_answer','job_id',j.id,'question_index',p_question,'result_digest',p_result_digest)) returning id into artifact;
 insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,j.id::text,'answer',q,to_jsonb(p_answer),eventops_private.hash(to_jsonb(p_answer))) returning id into source;
 insert into public.review_answers(workspace_id,event_id,job_id,draft_id,question_index,question,answer_json,source_record_id,actor,draft_generation,create_key,request_digest,receipt) values(ev.workspace_id,ev.id,j.id,d.id,p_question,q,jsonb_build_object('type','text','value',p_answer),source,auth.uid(),(receipt->>'generation')::integer,p_key,request,receipt);
 return receipt;
end $$;

-- Include every acknowledged text generation and job in restore review, not a capped UI list.
create function eventops_private.restore_context(p_event uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'generation',generation,'text',corrected_text) order by id) from public.text_update_drafts where event_id=p_event),'[]'::jsonb),'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'result_digest',j.result_digest,'text',u.confirmed_text) order by j.id) from public.analysis_jobs j join public.updates u on u.id=j.update_id where j.event_id=p_event and not exists(select 1 from public.proposals p where p.update_id=j.update_id and p.state in ('approved','rejected'))),'[]'::jsonb));
$$;
create function public.restore_review_context(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;context jsonb;
begin ev:=eventops_private.lock_event(p_event_id);context:=eventops_private.restore_context(ev.id);return jsonb_build_object('context',context,'digest',eventops_private.hash(context));end $$;

-- Private constructor shares normalization, fresh evidence and checks with manual proposals.
create function eventops_private.review_candidate(p_event_id uuid,p_head uuid,p_patch jsonb,p_reason text,p_key uuid,p_parent uuid,p_target uuid,p_confirmed boolean,p_withdraw boolean) returns jsonb
language plpgsql set search_path='' as $$
declare ev public.events;old public.proposals;existing public.proposals;proposal public.proposals;base jsonb;historical jsonb;prior jsonb;candidate jsonb;coverage jsonb;report jsonb;patch jsonb:='[]';k text;request text;u uuid;generation integer:=1;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_key is null or p_head is null or p_confirmed is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then raise sqlstate '22023' using message='Confirm exact facts and reason';end if;
 request:=eventops_private.hash(jsonb_build_object('head',p_head,'patch',p_patch,'reason',p_reason,'parent',p_parent,'target',p_target,'withdraw',p_withdraw));
 select * into existing from public.proposals where event_id=ev.id and create_key=p_key;
 if found then if existing.request_digest<>request then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return to_jsonb(existing);end if;
 if ev.status<>'active' or ev.current_revision_id is distinct from p_head then raise sqlstate 'P0001' using message='Stale plan';end if;
 select snapshot into base from public.revisions where id=p_head and event_id=ev.id;
 prior:=base;
 if p_parent is not null then
  select * into old from public.proposals where id=p_parent and event_id=ev.id and workspace_id=ev.workspace_id for update;
  if old.id is null then raise sqlstate 'P0002' using message='Proposal not found';end if;
  if old.state not in ('ready','infeasible') or old.base_revision_id<>p_head or exists(select 1 from public.proposals where parent_proposal_id=old.id) then raise sqlstate 'P0001' using message='Proposal changed';end if;
  if old.analysis_job_id is not null and p_withdraw is distinct from true then raise sqlstate '22023' using message='Explicit withdrawal of original interpreted requests required';end if;
  generation:=old.generation+1;
  prior:=old.candidate_snapshot;
 end if;
 if p_target is not null then
  select snapshot into historical from public.revisions where id=p_target and event_id=ev.id and workspace_id=ev.workspace_id;
  if historical is null then raise sqlstate 'P0002' using message='Revision not found';end if;
  if p_parent is null then
   prior:=historical;p_patch:='[]';
   foreach k in array array['event','rooms','sessions','volunteers','availability','assignments','dependencies'] loop
    p_patch:=p_patch||jsonb_build_array(jsonb_build_object('op','replace','path','/'||k,'value',historical->k));
   end loop;
  end if;
 end if;
 candidate:=eventops_private.apply_patch(base,p_patch);
 -- Only IDs already in the current plan or the trusted previous candidate/restore target survive.
 foreach k in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  prior:=jsonb_set(prior,array[k],(select coalesce(jsonb_agg(v),'[]') from (select distinct on (v->>'id') v from jsonb_array_elements((prior->k)||(base->k)) v) records));
 end loop;
 candidate:=eventops_private.normalize_plan(candidate,prior,candidate->'event');
 coverage:=eventops_private.request_coverage(base,candidate);
 if jsonb_array_length(coverage)=0 then raise sqlstate '22023' using message='No plan changes';end if;
 candidate:=eventops_private.capture_plan(candidate,base,ev.workspace_id,ev.id,auth.uid(),case when p_target is null then 'edited_proposal' else 'restore_reconfirmation' end);
 foreach k in array array['event','rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  if base->k is distinct from candidate->k then patch:=patch||jsonb_build_array(jsonb_build_object('op','replace','path','/'||k,'value',candidate->k));end if;
 end loop;
 report:=eventops_private.validate_plan(candidate);
 insert into public.updates(workspace_id,event_id,input_kind,raw_text,confirmed_text,state,confirmed_by) values(ev.workspace_id,ev.id,'manual_edit',p_reason,p_reason,'text_confirmed',auth.uid()) returning id into u;
 insert into public.proposals(workspace_id,event_id,update_id,base_revision_id,generation,state,candidate_snapshot,canonical_patch,candidate_digest,patch_digest,constraint_report,request_coverage,validator_version,create_key,request_digest,parent_proposal_id,restores_revision_id,review_assertions) values(ev.workspace_id,ev.id,u,p_head,generation,case when jsonb_array_length(report)=0 then 'ready' else 'infeasible' end,candidate,patch,eventops_private.hash(candidate),eventops_private.hash(patch),report,coverage,'plan-v1',p_key,request,p_parent,p_target,jsonb_build_object('exact_facts_confirmed',true,'historical_facts_reconfirmed',p_target is not null,'original_interpreted_requests_withdrawn',coalesce(p_withdraw,false),'restore_context_digest',case when p_target is not null then eventops_private.hash(eventops_private.restore_context(ev.id)) else null end)) returning * into proposal;
 if p_parent is not null then update public.proposals set state='rejected' where id=p_parent;end if;
 insert into public.audit_events(workspace_id,event_id,action,actor,proposal_id,safe_metadata) values(ev.workspace_id,ev.id,'review_candidate_created',auth.uid(),proposal.id,jsonb_build_object('parent_proposal_id',p_parent,'restores_revision_id',p_target));
 return to_jsonb(proposal);
end $$;
create function public.edit_proposal(p_event_id uuid,p_proposal_id uuid,p_generation integer,p_patch jsonb,p_reason text,p_key uuid,p_confirmed boolean,p_withdraw boolean,p_context_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;p public.proposals;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into p from public.proposals where id=p_proposal_id and event_id=ev.id for update;
 if p.id is null then raise sqlstate 'P0002' using message='Proposal not found';end if;
 if p_generation is distinct from p.generation then raise sqlstate 'P0001' using message='Proposal changed';end if;
 if p.restores_revision_id is not null and p_context_digest is distinct from eventops_private.hash(eventops_private.restore_context(ev.id)) then raise sqlstate 'P0001' using message='Restore context changed';end if;
 return eventops_private.review_candidate(ev.id,p.base_revision_id,p_patch,p_reason,p_key,p.id,p.restores_revision_id,p_confirmed,p_withdraw);
end $$;
create function public.restore_revision(p_event_id uuid,p_target uuid,p_head uuid,p_key uuid,p_confirmed boolean,p_context_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform eventops_private.lock_event(p_event_id);
 if not exists(select 1 from public.proposals where event_id=p_event_id and create_key=p_key) and p_context_digest is distinct from eventops_private.hash(eventops_private.restore_context(p_event_id)) then raise sqlstate 'P0001' using message='Restore context changed';end if;
 return eventops_private.review_candidate(p_event_id,p_head,null,'Restore historical revision '||p_target::text||'. Organizer explicitly reconfirms historical availability and cancellations after reviewing current differences and pending updates.',p_key,null,p_target,p_confirmed,false);
end $$;

create table public.proposal_rejections(
 proposal_id uuid primary key,workspace_id uuid not null,event_id uuid not null,reason text not null check(length(reason)<=2000),actor uuid not null references public.profiles(user_id),created_at timestamptz not null default now(),
 foreign key(workspace_id,event_id,proposal_id) references public.proposals(workspace_id,event_id,id)
);
alter table public.proposal_rejections enable row level security;
revoke all on public.proposal_rejections from public,anon,authenticated;
grant select on public.proposal_rejections to authenticated;
create policy own_records on public.proposal_rejections for select to authenticated using(workspace_id in(select id from public.workspaces) and event_id in(select id from public.events));
create trigger immutable_record before update on public.proposal_rejections for each row execute function eventops_private.immutable_record();
create function public.reject_proposal_with_reason(p_event_id uuid,p_proposal_id uuid,p_generation integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;r jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_reason is null or length(p_reason)>2000 then raise sqlstate '22023' using message='Invalid reason';end if;
 r:=public.reject_proposal(ev.id,p_proposal_id,p_generation);
 if exists(select 1 from public.proposal_rejections where proposal_id=p_proposal_id and reason<>p_reason) then raise sqlstate 'P0001' using message='Rejection already recorded';end if;
 insert into public.proposal_rejections(proposal_id,workspace_id,event_id,reason,actor) values(p_proposal_id,ev.workspace_id,ev.id,p_reason,auth.uid()) on conflict do nothing;
 return r;
end $$;
revoke all on all functions in schema eventops_private from public,anon,authenticated,eventops_worker;
revoke all on function public.restore_review_context(uuid),public.answer_analysis(uuid,uuid,text,integer,integer,text,uuid),public.edit_proposal(uuid,uuid,integer,jsonb,text,uuid,boolean,boolean,text),public.restore_revision(uuid,uuid,uuid,uuid,boolean,text),public.reject_proposal_with_reason(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.restore_review_context(uuid),public.answer_analysis(uuid,uuid,text,integer,integer,text,uuid),public.edit_proposal(uuid,uuid,integer,jsonb,text,uuid,boolean,boolean,text),public.restore_revision(uuid,uuid,uuid,uuid,boolean,text),public.reject_proposal_with_reason(uuid,uuid,integer,text) to authenticated;

-- Guard restoration context inside the same approval transaction, preserving receipt replay.
alter function public.approve_proposal(uuid,uuid,uuid,integer,text,uuid) set schema eventops_private;
alter function eventops_private.approve_proposal(uuid,uuid,uuid,integer,text,uuid) rename to approve_before_review;
revoke all on function eventops_private.approve_before_review(uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated,eventops_worker;
create function public.approve_proposal(p_event_id uuid,p_proposal_id uuid,p_base_revision_id uuid,p_generation integer,p_candidate_digest text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;p public.proposals;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if not exists(select 1 from public.approval_receipts where event_id=ev.id and actor=auth.uid() and operation='approve' and idempotency_key=p_idempotency_key) then
  select * into p from public.proposals where id=p_proposal_id and event_id=ev.id for update;
  if p.restores_revision_id is not null and (p.review_assertions->>'historical_facts_reconfirmed' is distinct from 'true' or p.review_assertions->>'restore_context_digest' is distinct from eventops_private.hash(eventops_private.restore_context(ev.id))) then raise sqlstate 'P0001' using message='Restore context changed';end if;
  if exists(select 1 from public.proposals where id=p.parent_proposal_id and analysis_job_id is not null) and p.review_assertions->>'original_interpreted_requests_withdrawn' is distinct from 'true' then raise sqlstate '22023' using message='Request withdrawal missing';end if;
 end if;
 return eventops_private.approve_before_review(p_event_id,p_proposal_id,p_base_revision_id,p_generation,p_candidate_digest,p_idempotency_key);
end $$;
revoke all on function public.approve_proposal(uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.approve_proposal(uuid,uuid,uuid,integer,text,uuid) to authenticated;
