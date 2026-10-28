-- Conservative audio reservation covers three maximum duration calls, including unknown usage.
alter table public.voice_jobs add column reserved_usd numeric(9,6) not null default 0.018 check(reserved_usd=0.018);
create or replace function public.begin_voice(p_event_id uuid,p_key uuid,p_sha256 text,p_bytes integer,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.voice_jobs;n uuid:=gen_random_uuid();total numeric;today numeric;workspace_today numeric;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.status<>'active' or ev.current_revision_id is null then raise sqlstate 'P0001' using message='Confirm a starting plan first';end if;
 select * into j from public.voice_jobs where event_id=ev.id and create_key=p_key;
 if found then
  if j.sha256 is distinct from p_sha256 or j.byte_length is distinct from p_bytes or j.mime is distinct from p_mime then raise sqlstate 'P0001' using message='Idempotency key reused';end if;
  return to_jsonb(j);
 end if;
 if not (select enabled from eventops_private.voice_gate) then raise sqlstate '42501' using message='Transcription disabled';end if;
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select coalesce(sum(cost),0),coalesce(sum(cost) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),coalesce(sum(cost) filter(where workspace_id=ev.workspace_id and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0) into total,today,workspace_today from (select reserved_usd cost,created_at,workspace_id from public.voice_jobs union all select charged_usd,created_at,workspace_id from public.model_runs) ledger;
 if total+0.018>50 or today+0.018>10 or workspace_today+0.018>2 then raise sqlstate 'P0001' using message='Recording budget reached';end if;
 if (select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and created_at>date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 or
    (select count(*) from public.voice_jobs where created_at>date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=1000 or
    (select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and state in ('uploading','queued','running'))>=2 then raise sqlstate 'P0001' using message='Recording limit reached';end if;
 insert into public.voice_jobs(id,workspace_id,event_id,create_key,object_key,sha256,byte_length,mime)
 values(n,ev.workspace_id,ev.id,p_key,ev.workspace_id||'/'||ev.id||'/'||n,p_sha256,p_bytes,p_mime) returning * into j;
 return to_jsonb(j);
end $$;

-- Bound the total analysis attempts across every saved generation of an update.
create or replace function eventops_private.reserve_analysis(j public.analysis_jobs,next_attempt integer) returns boolean
language plpgsql volatile set search_path='' as $$
declare global_total numeric;global_today numeric;workspace_today numeric;hour_count integer;
begin
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select coalesce(sum(charged_usd),0),coalesce(sum(charged_usd) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),coalesce(sum(charged_usd) filter(where workspace_id=j.workspace_id and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),count(*) filter(where workspace_id=j.workspace_id and created_at>now()-interval '1 hour') into global_total,global_today,workspace_today,hour_count from public.model_runs;
 select global_total+coalesce(sum(reserved_usd),0),global_today+coalesce(sum(reserved_usd) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),workspace_today+coalesce(sum(reserved_usd) filter(where workspace_id=j.workspace_id and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0) into global_total,global_today,workspace_today from public.voice_jobs;
 if (select coalesce(sum(attempts),0) from public.analysis_jobs where draft_id=j.draft_id)+(next_attempt-j.attempts)>10 then return false;end if;
 if global_total+0.15>50 or global_today+0.15>10 or workspace_today+0.15>2 or hour_count>=10 or next_attempt>10 then return false;end if;
 insert into public.model_runs(workspace_id,event_id,job_id,attempt) values(j.workspace_id,j.event_id,j.id,next_attempt);return true;
end $$;
