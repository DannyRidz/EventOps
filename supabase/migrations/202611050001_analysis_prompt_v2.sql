-- Legacy claim() workers retain v1. New workers declare their policy in the
-- same transaction as the existing lease claim. Historical runs are untouched.
create function eventops_worker_api.claim(p_prompt_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job jsonb;
begin
 if p_prompt_version is distinct from 'eventops-text-v2' then
  raise sqlstate '22023' using message='Unsupported analysis prompt version';
 end if;
 job:=eventops_worker_api.claim();
 if job is null then return null;end if;
 update public.model_runs r set prompt_version=p_prompt_version
 from public.analysis_jobs j
 where j.id=(job->>'id')::uuid and j.lease_token=(job->>'lease_token')::uuid
 and r.job_id=j.id and r.attempt=j.attempts and r.state='reserved';
 if not found then
  raise sqlstate 'P0001' using message='Missing claimed model reservation';
 end if;
 return job;
end $$;
revoke all on function eventops_worker_api.claim(text) from public,anon,authenticated;
grant execute on function eventops_worker_api.claim(text) to eventops_worker;
