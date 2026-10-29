-- Exclude only the candidate being reviewed, not every pending restoration.
drop function eventops_private.restore_context(uuid);
create function eventops_private.restore_context(p_event uuid,p_exclude uuid default null) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'generation',generation,'text',corrected_text) order by id) from public.text_update_drafts where event_id=p_event),'[]'::jsonb),
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'state',j.state,'result_digest',j.result_digest,'text',u.confirmed_text) order by j.id) from public.analysis_jobs j join public.updates u on u.id=j.update_id where j.event_id=p_event and not exists(select 1 from public.proposals p where p.update_id=j.update_id and p.state in ('approved','rejected'))),'[]'::jsonb),
 'manual_proposals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'generation',p.generation,'digest',p.candidate_digest,'text',u.confirmed_text) order by p.id) from public.proposals p join public.updates u on u.id=p.update_id where p.event_id=p_event and p.id is distinct from p_exclude and p.analysis_job_id is null and p.state in ('ready','infeasible')),'[]'::jsonb));
$$;
drop function public.restore_review_context(uuid);
create function public.restore_review_context(p_event_id uuid,p_exclude_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;context jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_exclude_id is not null and not exists(select 1 from public.proposals where id=p_exclude_id and event_id=ev.id) then raise sqlstate 'P0002' using message='Proposal not found';end if;
 context:=eventops_private.restore_context(ev.id,p_exclude_id);return jsonb_build_object('context',context,'digest',eventops_private.hash(context));
end $$;
-- Preserve the previously verified constructor and approval code, changing only the exclusion.
do $$ declare body text;
begin
 select pg_get_functiondef('eventops_private.review_candidate(uuid,uuid,jsonb,text,uuid,uuid,uuid,boolean,boolean)'::regprocedure) into body;
 execute replace(body,'eventops_private.restore_context(ev.id)','eventops_private.restore_context(ev.id,p_parent)');
 select pg_get_functiondef('public.edit_proposal(uuid,uuid,integer,jsonb,text,uuid,boolean,boolean,text)'::regprocedure) into body;
 execute replace(body,'eventops_private.restore_context(ev.id)','eventops_private.restore_context(ev.id,p.id)');
 select pg_get_functiondef('public.approve_proposal(uuid,uuid,uuid,integer,text,uuid)'::regprocedure) into body;
 execute replace(body,'eventops_private.restore_context(ev.id)','eventops_private.restore_context(ev.id,p.id)');
end $$;
revoke all on function eventops_private.restore_context(uuid,uuid) from public,anon,authenticated,eventops_worker;
revoke all on function public.restore_review_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.restore_review_context(uuid,uuid) to authenticated;
