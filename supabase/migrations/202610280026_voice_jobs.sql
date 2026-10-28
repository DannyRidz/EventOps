alter table public.source_artifacts drop constraint source_artifacts_kind_check;
alter table public.source_artifacts add constraint source_artifacts_kind_check check(kind in ('manual','csv','audio'));
alter table public.updates drop constraint updates_input_kind_check;
alter table public.updates add constraint updates_input_kind_check check(input_kind in ('manual_edit','text','voice'));
-- Private recordings and restricted, leased transcription. Live access defaults off.
create table eventops_private.voice_gate(id boolean primary key default true check(id),enabled boolean not null default false);
insert into eventops_private.voice_gate values(true,false);
create table public.voice_jobs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,create_key uuid not null,
 object_key text not null unique,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),byte_length integer not null check(byte_length between 1 and 10485760),mime text not null check(mime in ('audio/webm','audio/mp4')),
 state text not null default 'uploading' check(state in ('uploading','queued','running','completed','failed','discarded')),
 created_at timestamptz not null default now(),finished_at timestamptz,delete_after timestamptz not null default now()+interval '7 days',audio_deleted_at timestamptz,
 lease_token uuid,lease_until timestamptz,attempts integer not null default 0 check(attempts between 0 and 3),error_code text,
 draft_id uuid,duration_ms integer check(duration_ms between 1 and 120000),
 unique(event_id,create_key),foreign key(workspace_id,event_id) references public.events(workspace_id,id),
 foreign key(workspace_id,event_id,draft_id) references public.text_update_drafts(workspace_id,event_id,id)
);
alter table public.voice_jobs enable row level security;
revoke all on public.voice_jobs from public,anon,authenticated,eventops_worker;
grant select on public.voice_jobs to authenticated;
create policy own_voice on public.voice_jobs for select to authenticated using(workspace_id in(select id from public.workspaces where owner_user_id=(select auth.uid()) and deletion_requested_at is null) and event_id in(select id from public.events where status<>'trashed'));
create unique index voice_event_active on public.voice_jobs(event_id) where state in ('uploading','queued','running');
create function public.begin_voice(p_event_id uuid,p_key uuid,p_sha256 text,p_bytes integer,p_mime text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.voice_jobs;n uuid:=gen_random_uuid();
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.status<>'active' or ev.current_revision_id is null then raise sqlstate 'P0001' using message='Confirm a starting plan first';end if;
 select * into j from public.voice_jobs where event_id=ev.id and create_key=p_key;
 if found then
  if j.sha256 is distinct from p_sha256 or j.byte_length is distinct from p_bytes or j.mime is distinct from p_mime then raise sqlstate 'P0001' using message='Idempotency key reused';end if;
  return to_jsonb(j);
 end if;
 if not (select enabled from eventops_private.voice_gate) then raise sqlstate '42501' using message='Transcription disabled';end if;
 perform pg_advisory_xact_lock(781243);
 if (select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and created_at>date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 or
    (select count(*) from public.voice_jobs where created_at>date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=1000 or
    (select count(*) from public.voice_jobs)>=5000 or
    (select count(*) from public.voice_jobs where workspace_id=ev.workspace_id and state in ('uploading','queued','running'))>=2 then raise sqlstate 'P0001' using message='Recording limit reached';end if;
 insert into public.voice_jobs(id,workspace_id,event_id,create_key,object_key,sha256,byte_length,mime)
 values(n,ev.workspace_id,ev.id,p_key,ev.workspace_id||'/'||ev.id||'/'||n,p_sha256,p_bytes,p_mime) returning * into j;
 return to_jsonb(j);
end $$;
create function public.queue_voice(p_event_id uuid,p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.voice_jobs;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into j from public.voice_jobs where event_id=ev.id and id=p_job_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Recording not found';end if;
 if j.state='uploading' then
  if not exists(select 1 from storage.objects where bucket_id='event-audio' and name=j.object_key) then raise sqlstate '22023' using message='Recording upload missing';end if;
  update public.voice_jobs set state='queued' where id=j.id returning * into j;
 end if;
 return to_jsonb(j);
end $$;
create function public.discard_voice(p_event_id uuid,p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.voice_jobs;
begin
 ev:=eventops_private.lock_event(p_event_id);
 update public.voice_jobs set state=case when state='completed' then state else 'discarded' end,lease_token=null,lease_until=null,delete_after=now() where id=p_job_id and event_id=ev.id returning * into j;
 if j.id is null then raise sqlstate 'P0002' using message='Recording not found';end if;
 return to_jsonb(j);
end $$;
-- Storage checks run as narrow definers, without granting workers table access.
create function public.voice_object_access(p_name text,p_delete boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.voice_jobs j join public.events e on e.id=j.event_id join public.workspaces w on w.id=j.workspace_id where j.object_key=p_name and
 ((current_setting('request.jwt.claims',true)::jsonb->>'role'='eventops_worker' and (not p_delete or j.delete_after<=now())) or
 (w.owner_user_id=auth.uid() and w.deletion_requested_at is null and e.status<>'trashed' and (not p_delete or j.delete_after<=now()))) and (p_delete or j.audio_deleted_at is null and j.delete_after>now()));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-audio','event-audio',false,10485760,array['audio/webm','audio/mp4']);
create policy voice_read on storage.objects for select to authenticated,eventops_worker using(bucket_id='event-audio' and public.voice_object_access(name));
create policy voice_insert on storage.objects for insert to authenticated with check(bucket_id='event-audio' and exists(select 1 from public.voice_jobs j where j.object_key=objects.name and j.state='uploading' and j.created_at>now()-interval '10 minutes'));
create policy voice_delete on storage.objects for delete to authenticated,eventops_worker using(bucket_id='event-audio' and public.voice_object_access(name,true));
create function eventops_worker_api.claim_voice() returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.voice_jobs;
begin
 if not (select enabled from eventops_private.voice_gate) then return null;end if;
 update public.voice_jobs set state='failed',error_code='TRANSCRIPTION_INTERRUPTED',finished_at=now(),delete_after=least(delete_after,now()+interval '24 hours') where state='running' and lease_until<now() and attempts>=3;
 select v.* into j from public.voice_jobs v join public.events e on e.id=v.event_id join public.workspaces w on w.id=v.workspace_id where (v.state='queued' or v.state='running' and v.lease_until<now()) and v.attempts<3 and v.delete_after>now() and e.status='active' and w.deletion_requested_at is null order by v.created_at for update of v skip locked limit 1;
 if j.id is null then return null;end if;
 update public.voice_jobs set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
create function eventops_worker_api.finish_voice(p_id uuid,p_token uuid,p_text text,p_duration integer,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.voice_jobs;d jsonb;a uuid;
begin
 select * into j from public.voice_jobs where id=p_id for update;
 if j.id is null or j.state<>'running' or j.lease_token is distinct from p_token or j.lease_until<=now() then return false;end if;
 if not exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where e.id=j.event_id and e.status='active' and w.deletion_requested_at is null) then p_error:='TRANSCRIPTION_CANCELLED';end if;
 if p_error is null then
  if p_text is null or length(btrim(p_text)) not between 1 and 10000 or p_duration is null or p_duration not between 1 and 120000 then raise sqlstate '22023' using message='Invalid transcript';end if;
  -- save_text_update checks auth ownership. Supply only the recorded owner, never model input.
  perform set_config('request.jwt.claim.sub',(select owner_user_id::text from public.workspaces where id=j.workspace_id),true);
  d:=public.save_text_update(j.event_id,p_text,p_text,j.id);
  insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,object_key,metadata) values(j.workspace_id,j.event_id,'audio',j.sha256,auth.uid(),j.object_key,jsonb_build_object('voice_job_id',j.id,'draft_id',d->>'id','byte_length',j.byte_length,'duration_ms',p_duration,'model','muse-voice-transcribe-1.0')) returning id into a;
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(j.workspace_id,j.event_id,a,d->>'id','original_transcript','Original transcript, characters 0 to '||length(p_text),to_jsonb(p_text),eventops_private.hash(to_jsonb(p_text)));
 end if;
 update public.voice_jobs set state=case when p_error is null then 'completed' else 'failed' end,draft_id=(d->>'id')::uuid,duration_ms=case when p_error is null then p_duration end,error_code=case when p_error is null then null else 'TRANSCRIPTION_FAILED' end,finished_at=now(),delete_after=least(delete_after,now()+interval '24 hours'),lease_token=null,lease_until=null where id=j.id;
 return true;
end $$;
create function eventops_worker_api.voice_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 update public.voice_jobs set state='failed',error_code='TRANSCRIPTION_INTERRUPTED',delete_after=now() where state='uploading' and created_at<now()-interval '10 minutes';
 update public.voice_jobs set state='failed',error_code='TRANSCRIPTION_INTERRUPTED',delete_after=least(delete_after,now()) where state in ('queued','running') and delete_after<=now();
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'object_key',object_key)) from (select id,object_key from public.voice_jobs where delete_after<=now() and audio_deleted_at is null order by delete_after limit 100) v),'[]');
end $$;
create function eventops_worker_api.voice_deleted(p_id uuid) returns void language sql security definer set search_path='' as $$
 update public.voice_jobs set audio_deleted_at=now() where id=p_id and delete_after<=now() and not exists(select 1 from storage.objects where bucket_id='event-audio' and name=object_key);
$$;
revoke all on function public.begin_voice(uuid,uuid,text,integer,text),public.queue_voice(uuid,uuid),public.discard_voice(uuid,uuid),public.voice_object_access(text,boolean) from public,anon;
grant execute on function public.begin_voice(uuid,uuid,text,integer,text),public.queue_voice(uuid,uuid),public.discard_voice(uuid,uuid) to authenticated;
grant execute on function public.voice_object_access(text,boolean) to authenticated,eventops_worker;
revoke all on function eventops_worker_api.claim_voice(),eventops_worker_api.finish_voice(uuid,uuid,text,integer,text),eventops_worker_api.voice_cleanup(),eventops_worker_api.voice_deleted(uuid) from public,anon,authenticated;
grant execute on function eventops_worker_api.claim_voice(),eventops_worker_api.finish_voice(uuid,uuid,text,integer,text),eventops_worker_api.voice_cleanup(),eventops_worker_api.voice_deleted(uuid) to eventops_worker;

create or replace function public.confirm_text_analysis(p_event_id uuid,p_draft_id uuid,p_generation integer,p_base_revision_id uuid,p_confirmed_text text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.text_update_drafts;job public.analysis_jobs;u uuid;artifact uuid;source uuid;digest text;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_confirmed is distinct from true or p_base_revision_id is null or p_generation is null or p_confirmed_text is null or length(btrim(p_confirmed_text)) not between 1 and 10000 then raise sqlstate '22023' using message='Confirm exact text and revision';end if;
 select * into draft from public.text_update_drafts where id=p_draft_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if draft.id is null then raise sqlstate 'P0002' using message='Update not found';end if;
 select * into job from public.analysis_jobs where draft_id=draft.id and draft_generation=p_generation and base_revision_id=p_base_revision_id;
 if job.id is not null then
  if job.confirmed_text_digest<>eventops_private.hash(to_jsonb(p_confirmed_text)) then raise sqlstate 'P0001' using message='Text changed';end if;
  return to_jsonb(job);
 end if;
 if ev.current_revision_id is distinct from p_base_revision_id or ev.status<>'active' then raise sqlstate 'P0001' using message='Stale plan';end if;
 if draft.generation is distinct from p_generation or p_confirmed_text is distinct from draft.corrected_text then raise sqlstate 'P0001' using message='Draft changed';end if;
 update public.voice_jobs set delete_after=now() where draft_id=draft.id;
 -- Repeat identical confirmed text against the same head reuses acknowledged work.
 digest:=eventops_private.hash(to_jsonb(draft.corrected_text));
 select * into job from public.analysis_jobs where event_id=ev.id and base_revision_id=p_base_revision_id and confirmed_text_digest=digest order by created_at limit 1;
 if job.id is not null then return to_jsonb(job);end if;
 insert into public.updates(workspace_id,event_id,input_kind,raw_text,confirmed_text,state,confirmed_by) values(ev.workspace_id,ev.id,case when exists(select 1 from public.voice_jobs where draft_id=draft.id and state='completed') then 'voice' else 'text' end,draft.raw_text,draft.corrected_text,'text_confirmed',auth.uid()) returning id into u;
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',digest,auth.uid(),jsonb_build_object('kind','confirmed_text','update_id',u,'draft_generation',draft.generation)) returning id into artifact;
 insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,u::text,'confirmed_text','Confirmed organizer text, characters 0 to '||length(draft.corrected_text),to_jsonb(draft.corrected_text),digest) returning id into source;
 insert into public.analysis_jobs(workspace_id,event_id,update_id,base_revision_id,draft_id,draft_generation,confirmed_text_digest) values(ev.workspace_id,ev.id,u,p_base_revision_id,draft.id,draft.generation,digest) returning * into job;
 return to_jsonb(job);
end $$;
