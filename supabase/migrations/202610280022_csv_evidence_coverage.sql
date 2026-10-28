-- Use a set difference so coverage never degenerates into a quadratic anti join.
-- Validate every source value with one set join instead of per-field correlated scans.
create or replace function eventops_private.evidence_valid(p jsonb,prior jsonb,w uuid,e uuid) returns boolean
language sql stable set search_path='' as $$
 with facts as materialized (
  select * from eventops_private.plan_facts(p)
  union all select * from eventops_private.change_facts(prior,p) where field_path='$record'
 ), entries as materialized (
  select value->>'record_id' record_id,value->>'field_path' field_path,value->'source_record_ids' refs
  from jsonb_array_elements(p->'provenance')
 ), references_ as materialized (
  select entries.record_id,entries.field_path,ref.value::uuid source_id from entries cross join lateral jsonb_array_elements_text(refs) ref
 ), resolved as materialized (
  select r.record_id,r.field_path,f.value_json fact_value,s.id,s.record_id source_record,s.field_path source_field,s.value_json source_value,s.sha256
  from references_ r left join facts f on f.record_id=r.record_id and f.field_path=r.field_path
  left join public.source_records s on s.id=r.source_id and s.workspace_id=w and s.event_id=e
 )
 select (select count(*) from facts)=(select count(*) from entries)
 and (select count(*) from entries)=(select count(distinct (record_id,field_path)) from entries)
 and not exists(select 1 from entries where refs is null or jsonb_array_length(refs)=0)
 and not exists(select record_id,field_path from facts except select record_id,field_path from entries)
 and not exists(select 1 from resolved where id is null or fact_value is null or source_record<>record_id or source_field<>field_path or source_value<>fact_value or sha256<>eventops_private.hash(source_value));
$$;
