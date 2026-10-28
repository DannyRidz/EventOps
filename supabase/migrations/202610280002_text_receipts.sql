-- Preserve an immutable creation receipt separately from subsequent draft edits.
-- Existing drafts without a receipt retain conservative replay behavior.
alter table public.text_update_drafts add column creation_request_digest text;
alter table public.text_update_drafts add column creation_receipt jsonb;
create or replace function public.save_text_update(p_event_id uuid,p_raw_text text,p_corrected_text text,p_key uuid,p_draft_id uuid default null,p_generation integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.text_update_drafts;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.current_revision_id is null then raise sqlstate 'P0001' using message='Confirm a starting plan first';end if;
 if p_key is null or p_raw_text is null or p_corrected_text is null or length(btrim(p_raw_text)) not between 1 and 10000 or length(btrim(p_corrected_text)) not between 1 and 10000 then raise sqlstate '22023' using message='Text required';end if;
 if p_draft_id is null then
  select * into draft from public.text_update_drafts where event_id=ev.id and create_key=p_key;
  if draft.id is not null then
   if draft.creation_request_digest is not null then
    if draft.creation_request_digest<>eventops_private.hash(jsonb_build_object('raw_text',p_raw_text,'corrected_text',p_corrected_text)) then raise sqlstate 'P0001' using message='Idempotency key reused';end if;
    return draft.creation_receipt;
   end if;
   -- Legacy drafts have no creation receipt. Do not invent their original correction.
   if draft.raw_text<>p_raw_text or draft.corrected_text<>p_corrected_text then raise sqlstate 'P0001' using message='Idempotency key reused';end if;
   return to_jsonb(draft)-'creation_receipt'-'creation_request_digest';
  end if;
  insert into public.text_update_drafts(workspace_id,event_id,raw_text,corrected_text,creation_request_digest,create_key) values(ev.workspace_id,ev.id,p_raw_text,p_corrected_text,eventops_private.hash(jsonb_build_object('raw_text',p_raw_text,'corrected_text',p_corrected_text)),p_key) returning * into draft;

  update public.text_update_drafts set creation_receipt=to_jsonb(draft)-'creation_receipt'-'creation_request_digest' where id=draft.id;
 else
  select * into draft from public.text_update_drafts where id=p_draft_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
  if draft.id is null then raise sqlstate 'P0002' using message='Update not found';end if;
  -- Resolve a lost response before rejecting an obsolete expected generation.
  if draft.generation=p_generation+1 and draft.raw_text=p_raw_text and draft.corrected_text=p_corrected_text then return to_jsonb(draft)-'creation_receipt'-'creation_request_digest';end if;
  if p_generation is distinct from draft.generation or p_raw_text<>draft.raw_text then raise sqlstate 'P0001' using message='Draft changed';end if;
  if draft.corrected_text=p_corrected_text then return to_jsonb(draft)-'creation_receipt'-'creation_request_digest';end if;
  update public.text_update_drafts set corrected_text=p_corrected_text,generation=generation+1,saved_at=clock_timestamp() where id=draft.id returning * into draft;
 end if;
 return to_jsonb(draft)-'creation_receipt'-'creation_request_digest';
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
