-- Text drafts and immutable confirmations. No provider calls are authorized by this migration.
alter table public.updates drop constraint updates_input_kind_check;
alter table public.updates add constraint updates_input_kind_check check(input_kind in ('manual_edit','text'));
create table public.text_update_drafts (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,
 raw_text text not null check(length(raw_text) between 1 and 10000),corrected_text text not null check(length(corrected_text) between 1 and 10000),
 generation integer not null default 1 check(generation>0),create_key uuid not null,created_at timestamptz not null default now(),saved_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),unique(event_id,create_key),foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
create table public.analysis_jobs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,update_id uuid not null,base_revision_id uuid not null,draft_id uuid not null,draft_generation integer not null,
 state text not null default 'blocked' check(state='blocked'),stage text not null default 'Awaiting model access' check(stage='Awaiting model access'),error_code text not null default 'META_ACCESS_NOT_VERIFIED' check(error_code='META_ACCESS_NOT_VERIFIED'),
 confirmed_text_digest text not null,created_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),unique(draft_id,draft_generation,base_revision_id),
 foreign key(workspace_id,event_id) references public.events(workspace_id,id),
 foreign key(workspace_id,event_id,update_id) references public.updates(workspace_id,event_id,id),
 foreign key(workspace_id,event_id,base_revision_id) references public.revisions(workspace_id,event_id,id),
 foreign key(workspace_id,event_id,draft_id) references public.text_update_drafts(workspace_id,event_id,id)
);
create trigger immutable_job before update on public.analysis_jobs for each row execute function eventops_private.immutable_record();
do $$ declare t text;begin foreach t in array array['text_update_drafts','analysis_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_records on public.%I for select to authenticated using(workspace_id in(select id from public.workspaces where owner_user_id=(select auth.uid()) and deletion_requested_at is null) and event_id in(select id from public.events where status<>''trashed''))',t);
end loop;end $$;
create function public.save_text_update(p_event_id uuid,p_raw_text text,p_corrected_text text,p_key uuid,p_draft_id uuid default null,p_generation integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.text_update_drafts;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.current_revision_id is null then raise sqlstate 'P0001' using message='Confirm a starting plan first';end if;
 if p_key is null or p_raw_text is null or p_corrected_text is null or length(btrim(p_raw_text)) not between 1 and 10000 or length(btrim(p_corrected_text)) not between 1 and 10000 then raise sqlstate '22023' using message='Text required';end if;
 if p_draft_id is null then
  select * into draft from public.text_update_drafts where event_id=ev.id and create_key=p_key;
  if draft.id is not null then
   if draft.raw_text<>p_raw_text or draft.corrected_text<>p_corrected_text then raise sqlstate 'P0001' using message='Idempotency key reused';end if;
   return to_jsonb(draft);
  end if;
  insert into public.text_update_drafts(workspace_id,event_id,raw_text,corrected_text,create_key) values(ev.workspace_id,ev.id,p_raw_text,p_corrected_text,p_key) returning * into draft;
 else
  select * into draft from public.text_update_drafts where id=p_draft_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
  if draft.id is null then raise sqlstate 'P0002' using message='Update not found';end if;
  -- Resolve a lost response before rejecting an obsolete expected generation.
  if draft.generation=p_generation+1 and draft.raw_text=p_raw_text and draft.corrected_text=p_corrected_text then return to_jsonb(draft);end if;
  if p_generation is distinct from draft.generation or p_raw_text<>draft.raw_text then raise sqlstate 'P0001' using message='Draft changed';end if;
  if draft.corrected_text=p_corrected_text then return to_jsonb(draft);end if;
  update public.text_update_drafts set corrected_text=p_corrected_text,generation=generation+1,saved_at=clock_timestamp() where id=draft.id returning * into draft;
 end if;
 return to_jsonb(draft);
end $$;
create function public.confirm_text_analysis(p_event_id uuid,p_draft_id uuid,p_generation integer,p_base_revision_id uuid,p_confirmed_text text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.text_update_drafts;job public.analysis_jobs;u uuid;artifact uuid;source uuid;digest text;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_confirmed is distinct from true or p_base_revision_id is null or p_generation is null then raise sqlstate '22023' using message='Confirm exact text and revision';end if;
 select * into draft from public.text_update_drafts where id=p_draft_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if draft.id is null then raise sqlstate 'P0002' using message='Update not found';end if;
 select * into job from public.analysis_jobs where draft_id=draft.id and draft_generation=p_generation and base_revision_id=p_base_revision_id;
 if job.id is not null then
  if job.confirmed_text_digest<>eventops_private.hash(to_jsonb(p_confirmed_text)) then raise sqlstate 'P0001' using message='Text changed';end if;
  return to_jsonb(job);
 end if;
 if ev.current_revision_id is distinct from p_base_revision_id or ev.status<>'active' then raise sqlstate 'P0001' using message='Stale plan';end if;
 if draft.generation is distinct from p_generation or p_confirmed_text is distinct from draft.corrected_text then raise sqlstate 'P0001' using message='Draft changed';end if;
 -- Repeat identical confirmed text against the same head reuses acknowledged work.
 digest:=eventops_private.hash(to_jsonb(draft.corrected_text));
 select * into job from public.analysis_jobs where event_id=ev.id and base_revision_id=p_base_revision_id and confirmed_text_digest=digest order by created_at limit 1;
 if job.id is not null then return to_jsonb(job);end if;
 insert into public.updates(workspace_id,event_id,input_kind,raw_text,confirmed_text,state,confirmed_by) values(ev.workspace_id,ev.id,'text',draft.raw_text,draft.corrected_text,'text_confirmed',auth.uid()) returning id into u;
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',digest,auth.uid(),jsonb_build_object('kind','confirmed_text','update_id',u,'draft_generation',draft.generation)) returning id into artifact;
 insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,u::text,'confirmed_text','Confirmed organizer text, characters 0 to '||length(draft.corrected_text),to_jsonb(draft.corrected_text),digest) returning id into source;
 insert into public.analysis_jobs(workspace_id,event_id,update_id,base_revision_id,draft_id,draft_generation,confirmed_text_digest) values(ev.workspace_id,ev.id,u,p_base_revision_id,draft.id,draft.generation,digest) returning * into job;
 return to_jsonb(job);
end $$;
revoke all on function public.save_text_update(uuid,text,text,uuid,uuid,integer),public.confirm_text_analysis(uuid,uuid,integer,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.save_text_update(uuid,text,text,uuid,uuid,integer),public.confirm_text_analysis(uuid,uuid,integer,uuid,text,boolean) to authenticated;
