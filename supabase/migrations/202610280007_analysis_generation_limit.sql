-- Bound the total analysis attempts across every saved generation of an update.
create or replace function eventops_private.reserve_analysis(j public.analysis_jobs,next_attempt integer) returns boolean
language plpgsql volatile set search_path='' as $$
declare global_total numeric;global_today numeric;workspace_today numeric;hour_count integer;
begin
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select coalesce(sum(charged_usd),0),coalesce(sum(charged_usd) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),coalesce(sum(charged_usd) filter(where workspace_id=j.workspace_id and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),count(*) filter(where workspace_id=j.workspace_id and created_at>now()-interval '1 hour') into global_total,global_today,workspace_today,hour_count from public.model_runs;
 if (select coalesce(sum(attempts),0) from public.analysis_jobs where draft_id=j.draft_id)+(next_attempt-j.attempts)>10 then return false;end if;
 if global_total+0.15>50 or global_today+0.15>10 or workspace_today+0.15>2 or hour_count>=10 or next_attempt>10 then return false;end if;
 insert into public.model_runs(workspace_id,event_id,job_id,attempt) values(j.workspace_id,j.event_id,j.id,next_attempt);return true;
end $$;
