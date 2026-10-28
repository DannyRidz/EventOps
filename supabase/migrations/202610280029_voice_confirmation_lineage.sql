-- Keep completion/discard lock order consistent and expose immutable transcript lineage.
create or replace function eventops_worker_api.finish_voice(p_id uuid,p_token uuid,p_text text,p_duration integer,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.voice_jobs;d jsonb;a uuid;
begin
 -- Match owner event-before-job locking to avoid a discard/completion deadlock.
 perform 1 from public.events where id=(select event_id from public.voice_jobs where id=p_id) for update;
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
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',digest,auth.uid(),jsonb_build_object('kind','confirmed_text','update_id',u,'draft_generation',draft.generation,'draft_id',draft.id,'voice_job_id',(select id from public.voice_jobs where draft_id=draft.id),'original_transcript_source_id',(select id from public.source_records where record_id=draft.id::text and field_path='original_transcript'))) returning id into artifact;
 insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,u::text,'confirmed_text','Confirmed organizer text, characters 0 to '||length(draft.corrected_text),to_jsonb(draft.corrected_text),digest) returning id into source;
 insert into public.analysis_jobs(workspace_id,event_id,update_id,base_revision_id,draft_id,draft_generation,confirmed_text_digest) values(ev.workspace_id,ev.id,u,p_base_revision_id,draft.id,draft.generation,digest) returning * into job;
 return to_jsonb(job);
end $$;
