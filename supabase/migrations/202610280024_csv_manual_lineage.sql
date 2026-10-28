-- Optional assignment coverage and later manual corrections retain import lineage.
alter table public.import_batches add column confirmed_generation integer;
create or replace function eventops_private.confirm_import_receipt() returns trigger language plpgsql set search_path='' as $$
declare snapshot_ jsonb;lineage record;
begin
 if new.operation='confirm' then
  select snapshot into snapshot_ from public.revisions where id=new.revision_id and event_id=new.event_id;
  for lineage in
   select distinct a.metadata->>'batch_id' batch_id,(a.metadata->>'generation')::integer generation
   from jsonb_array_elements(snapshot_->'provenance') p cross join lateral jsonb_array_elements_text(p.value->'source_record_ids') ref
   join public.source_records s on s.id=ref.value::uuid and s.event_id=new.event_id
   join public.source_artifacts a on a.id=s.artifact_id and a.event_id=new.event_id
   where a.metadata->>'operation'='csv_review'
  loop
   update public.import_batches set state='confirmed',revision_id=new.revision_id,confirmed_generation=lineage.generation where event_id=new.event_id and id=lineage.batch_id::uuid;
  end loop;
 end if;return new;
end $$;
