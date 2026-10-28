-- Read large artifact metadata once per artifact, rather than once per field.
create or replace function eventops_private.confirm_import_receipt() returns trigger language plpgsql set search_path='' as $$
declare snapshot_ jsonb;lineage record;
begin
 if new.operation='confirm' then
  select snapshot into snapshot_ from public.revisions where id=new.revision_id and event_id=new.event_id;
  for lineage in
   with selected_artifacts as materialized (
    select distinct s.artifact_id
    from jsonb_array_elements(snapshot_->'provenance') p cross join lateral jsonb_array_elements_text(p.value->'source_record_ids') ref
    join public.source_records s on s.id=ref.value::uuid and s.event_id=new.event_id
   )
   select distinct a.metadata->>'batch_id' batch_id,(a.metadata->>'generation')::integer generation
   from selected_artifacts selected join public.source_artifacts a on a.id=selected.artifact_id and a.event_id=new.event_id
   where a.metadata->>'operation'='csv_review' 
  loop
   update public.import_batches set state='confirmed',revision_id=new.revision_id,confirmed_generation=lineage.generation where event_id=new.event_id and id=lineage.batch_id::uuid;
  end loop;
 end if;return new;
end $$;
