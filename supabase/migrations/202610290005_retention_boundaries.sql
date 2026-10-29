-- Resolve retention from the authoritative current event, never the creation receipt.
create function eventops_private.retained_setup(e public.events) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select snapshot->'event' from public.revisions where id=e.current_revision_id),(select snapshot from public.plan_drafts where event_id=e.id),e.create_snapshot);
$$;
create or replace function eventops_private.retention_deadline(e public.events, days integer) returns timestamptz language sql stable security definer set search_path='' as $$
 select ((((eventops_private.retained_setup(e)->>'date')::date+days+1)::timestamp) at time zone (eventops_private.retained_setup(e)->>'timezone'));
$$;
-- Keep the tested existing worker implementations and add expiry to every event health predicate.
do $$ declare f record;definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='eventops_worker_api' and p.proname in ('claim','stage','finish','claim_voice','finish_voice')) or
 (n.nspname='public' and p.proname in ('voice_object_access','lifecycle_settings')) loop
 definition:=pg_get_functiondef(f.oid);
 definition:=replace(definition,'e.status=''active''','e.status=''active'' and eventops_private.event_deadline(e)>now()');
 definition:=replace(definition,'e.status<>''trashed''','e.status<>''trashed'' and eventops_private.event_deadline(e)>now()');
 definition:=replace(definition,'e.create_snapshot->>''date''','eventops_private.retained_setup(e)->>''date''');
 definition:=replace(definition,'e.create_snapshot->>''timezone''','eventops_private.retained_setup(e)->>''timezone''');
 execute definition;
 end loop;
end $$;
-- No direct raw receipt SELECT can bypass scheduled or explicit expiry.
revoke select on public.import_files from authenticated;
grant select(id,workspace_id,event_id,batch_id,artifact_id,collection,filename,sha256,original_table,created_at,content_deleted_at) on public.import_files to authenticated;
create function public.csv_original_receipt(p_event_id uuid,p_batch_id uuid,p_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('artifact_id',artifact_id,'original_bytes',encode(original_bytes,'hex')) from public.import_files where event_id=p_event_id and batch_id=p_batch_id and sha256=p_hash and public.csv_original_available(artifact_id);
$$;
revoke all on function public.csv_original_receipt(uuid,uuid,text) from public,anon;
grant execute on function public.csv_original_receipt(uuid,uuid,text) to authenticated;
revoke all on all functions in schema eventops_private from public,anon,authenticated,eventops_worker;
