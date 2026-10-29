-- Raw deletion also requires independent replay; all identifiers are opaque.
alter table eventops_private.deletion_tombstones drop constraint deletion_tombstones_kind_check;
alter table eventops_private.deletion_tombstones add constraint deletion_tombstones_kind_check check(kind in ('event','account','csv','audio'));
-- Recent actual sign in protects both account deletion and recovery changes.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.change_account_lifecycle(integer,text)'::regprocedure);
 definition:=replace(definition,' if p_action=''delete'' then','');
 definition:=replace(definition,'  if w.deletion_requested_at is not null then',E' if p_action=''delete'' then\n  if w.deletion_requested_at is not null then');
 execute definition;
end $$;
create or replace function public.delete_csv_original(p_event_id uuid,p_artifact_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 e:=eventops_private.lock_event(p_event_id);
 if not exists(select 1 from public.source_artifacts where id=p_artifact_id and event_id=e.id and kind='csv') then raise sqlstate 'P0002' using message='Original not found';end if;
 insert into eventops_private.raw_deletions(artifact_id) values(p_artifact_id) on conflict do nothing;
 update public.workspaces set lifecycle_generation=lifecycle_generation+1 where id=e.workspace_id;
end $$;
create or replace function eventops_worker_api.retention_sweep() returns jsonb language plpgsql security definer set search_path='' as $$
declare objects jsonb;targets jsonb;
begin
 delete from public.text_update_drafts d where saved_at<now()-interval '30 days' and not exists(select 1 from public.analysis_jobs j where j.draft_id=d.id) and not exists(select 1 from public.voice_jobs v where v.draft_id=d.id);
 -- The worker records these identifiers durably BEFORE requesting any raw deletion.
 select coalesce(jsonb_agg(t),'[]') into targets from (
 select 'event' as kind,e.id from public.events e join public.workspaces w on w.id=e.workspace_id where eventops_private.event_deadline(e)<=now() or w.purge_after<=now()
 union all select 'account',owner_user_id from public.workspaces where purge_after<=now()
 union all select 'csv',a.id from public.source_artifacts a join public.import_files f on f.artifact_id=a.id where f.content_deleted_at is null and (a.captured_at+interval '30 days'<=now() or exists(select 1 from eventops_private.raw_deletions d where d.artifact_id=a.id))
 union all select 'audio',id from public.voice_jobs where delete_after<=now() and audio_deleted_at is null limit 100) t;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into objects from (select o.bucket_id,o.name from storage.objects o where eventops_private.object_due(o.bucket_id,o.name) and (
 exists(select 1 from jsonb_array_elements(targets) t where (t->>'kind'='event' and t->>'id'=split_part(o.name,'/',2)) or (t->>'kind'='account' and exists(select 1 from public.workspaces w where w.owner_user_id::text=t->>'id' and w.id::text=split_part(o.name,'/',1))) or (t->>'kind'='csv' and exists(select 1 from public.source_artifacts a where a.id::text=t->>'id' and a.object_key=o.name)) or (t->>'kind'='audio' and exists(select 1 from public.voice_jobs j where j.id::text=t->>'id' and j.object_key=o.name))) or
 (not exists(select 1 from public.source_artifacts where object_key=o.name) and not exists(select 1 from public.voice_jobs where object_key=o.name))) order by o.created_at limit 100) q;
 return jsonb_build_object('objects',objects,'targets',targets);
end $$;
alter function eventops_worker_api.retention_purge(text,uuid) rename to retention_purge_entity;
revoke all on function eventops_worker_api.retention_purge_entity(text,uuid) from public,anon,authenticated,eventops_worker;
create function eventops_worker_api.retention_purge(p_kind text,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_kind='csv' then
  if not exists(select 1 from public.source_artifacts a join public.import_files f on f.artifact_id=a.id where a.id=p_id and (a.captured_at+interval '30 days'<=now() or exists(select 1 from eventops_private.raw_deletions d where d.artifact_id=a.id))) then return false;end if;
  if exists(select 1 from public.source_artifacts a join storage.objects o on o.name=a.object_key and o.bucket_id='event-imports' where a.id=p_id) then return false;end if;
  insert into eventops_private.deletion_tombstones(kind,id) values(p_kind,p_id) on conflict do nothing;
  update public.import_files set original_bytes=null,content_deleted_at=now() where artifact_id=p_id and content_deleted_at is null;
  return true;
 elsif p_kind='audio' then
  if not exists(select 1 from public.voice_jobs j where id=p_id and delete_after<=now()) then return false;end if;
  if exists(select 1 from public.voice_jobs j join storage.objects o on o.name=j.object_key and o.bucket_id='event-audio' where j.id=p_id) then return false;end if;
  insert into eventops_private.deletion_tombstones(kind,id) values(p_kind,p_id) on conflict do nothing;
  update public.voice_jobs set audio_deleted_at=coalesce(audio_deleted_at,now()) where id=p_id;
  return true;
 else return eventops_worker_api.retention_purge_entity(p_kind,p_id);end if;
end $$;
grant execute on function eventops_worker_api.retention_purge(text,uuid) to eventops_worker;
revoke all on function eventops_worker_api.retention_purge(text,uuid) from public,anon,authenticated;
