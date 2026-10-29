-- Include pending manual statements without making a restore fence itself.
create or replace function eventops_private.restore_context(p_event uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'generation',generation,'text',corrected_text) order by id) from public.text_update_drafts where event_id=p_event),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'result_digest',j.result_digest,'text',u.confirmed_text) order by j.id) from public.analysis_jobs j join public.updates u on u.id=j.update_id where j.event_id=p_event and not exists(select 1 from public.proposals p where p.update_id=j.update_id and p.state in ('approved','rejected'))),'[]'::jsonb),
 'manual_proposals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'generation',p.generation,'digest',p.candidate_digest,'text',u.confirmed_text) order by p.id) from public.proposals p join public.updates u on u.id=p.update_id where p.event_id=p_event and p.restores_revision_id is null and p.analysis_job_id is null and p.state in ('ready','infeasible')),'[]'::jsonb));
$$;
create or replace function public.edit_proposal(p_event_id uuid,p_proposal_id uuid,p_generation integer,p_patch jsonb,p_reason text,p_key uuid,p_confirmed boolean,p_withdraw boolean,p_context_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;p public.proposals;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into p from public.proposals where id=p_proposal_id and event_id=ev.id for update;
 if p.id is null then raise sqlstate 'P0002' using message='Proposal not found';end if;
 if p_generation is distinct from p.generation then raise sqlstate 'P0001' using message='Proposal changed';end if;
 if not exists(select 1 from public.proposals where event_id=ev.id and create_key=p_key) and p.restores_revision_id is not null and p_context_digest is distinct from eventops_private.hash(eventops_private.restore_context(ev.id)) then raise sqlstate 'P0001' using message='Restore context changed';end if;
 return eventops_private.review_candidate(ev.id,p.base_revision_id,p_patch,p_reason,p_key,p.id,p.restores_revision_id,p_confirmed,p_withdraw);
end $$;
revoke all on function eventops_private.restore_context(uuid) from public,anon,authenticated,eventops_worker;
