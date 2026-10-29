create function public.csv_original_status() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('artifact_id',a.id,'event_id',a.event_id,'filename',a.metadata->>'filename','available',public.csv_original_available(a.id))),'[]') from public.source_artifacts a where a.kind='csv' and public.retained_event(a.event_id);
$$;
revoke all on function public.csv_original_status() from public,anon;
grant execute on function public.csv_original_status() to authenticated;
-- Record finalized raw deletion even if an owner/audio process already removed the object.
-- The recovery runbook also suppresses all raw files until deletion history is reconciled.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('eventops_worker_api.retention_sweep()'::regprocedure);
 definition:=replace(definition,'delete_after<=now() and audio_deleted_at is null limit 100','delete_after<=now() and not exists(select 1 from eventops_private.deletion_tombstones t where t.kind=''audio'' and t.id=voice_jobs.id) limit 100');
 execute definition;
end $$;
