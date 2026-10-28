-- Cancellation fences a running worker and refunds only a queued attempt known not to have started.
create function public.cancel_analysis_job(p_event_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.analysis_jobs;
begin
 ev:=eventops_private.lock_event(p_event_id);
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select * into j from public.analysis_jobs where id=p_job_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Job not found';end if;
 if j.state in ('completed','stale','cancelled') then return to_jsonb(j);end if;
 if j.state='queued' then
  update public.model_runs set state='finished',charged_usd=0,calls=0,input_tokens=0,output_tokens=0 where job_id=j.id and attempt=j.attempts;
 elsif j.state='running' then
  update public.model_runs set state='abandoned' where job_id=j.id and attempt=j.attempts;
 end if;
 update public.analysis_jobs set state='cancelled',stage='Analysis cancelled',error_code=null,lease_token=null,lease_until=null where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.cancel_analysis_job(uuid,uuid) from public,anon,authenticated,eventops_worker;
grant execute on function public.cancel_analysis_job(uuid,uuid) to authenticated;
