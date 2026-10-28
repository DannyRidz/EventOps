-- All provider jobs share the two-active-jobs workspace bound and budget lock.
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
    (select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and state in ('uploading','queued','running'))+(select count(*) from public.analysis_jobs where workspace_id=ev.workspace_id and state in ('queued','running'))>=2 then raise sqlstate 'P0001' using message='Recording limit reached';end if;
 insert into public.voice_jobs(id,workspace_id,event_id,create_key,object_key,sha256,byte_length,mime)
 values(n,ev.workspace_id,ev.id,p_key,ev.workspace_id||'/'||ev.id||'/'||n,p_sha256,p_bytes,p_mime) returning * into j;
 return to_jsonb(j);
end $$;

create or replace function public.queue_analysis_job(p_event_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.analysis_jobs;draft public.text_update_drafts;
begin
 ev:=eventops_private.lock_event(p_event_id);
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select * into j from public.analysis_jobs where id=p_job_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Job not found';end if;
 if j.state in ('queued','running','completed') then return to_jsonb(j);end if;
 if j.state not in ('blocked','failed') then raise sqlstate 'P0001' using message='Start a new confirmed update';end if;
 if not (select enabled from eventops_private.analysis_budget_lock where id=1) then raise sqlstate '42501' using message='Model access is not enabled';end if;
 select * into draft from public.text_update_drafts where id=j.draft_id;
 if draft.generation<>j.draft_generation or ev.current_revision_id<>j.base_revision_id then raise sqlstate 'P0001' using message='Stale plan';end if;
 if exists(select 1 from public.analysis_jobs where event_id=ev.id and state in ('queued','running')) or (select count(*) from public.analysis_jobs where workspace_id=ev.workspace_id and state in ('queued','running'))+(select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and state in ('uploading','queued','running'))>=2 then raise sqlstate 'P0001' using message='Analysis concurrency limit';end if;
 if not eventops_private.reserve_analysis(j,j.attempts+1) then raise sqlstate 'P0001' using message='Analysis budget or rate limit';end if;
 update public.analysis_jobs set state='queued',stage='Queued',error_code=null,attempts=attempts+1,not_before=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

