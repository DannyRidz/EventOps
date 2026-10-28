-- Carry only mapped cells through evidence joins, never whole multi-megabyte files.
create or replace function eventops_private.import_field_sources(tables jsonb,candidate jsonb,b uuid) returns jsonb language sql stable set search_path='' as $$
 with files as materialized (
  select t.value->>'collection' collection,t.value->>'filename' filename,t.value->'headers' headers,t.value->'mapping' mapping,t.value->'excluded' excluded,t.value->'offsets' offsets,t.value->'lines' lines,t.value->'rows' rows_,f.original_table->'rows' original_rows,f.artifact_id,f.sha256,
    case t.value->>'collection' when 'rooms' then 'room_id' when 'sessions' then 'session_id' when 'volunteers' then 'volunteer_id' end idkey
  from jsonb_array_elements(tables) t join public.import_files f on f.batch_id=b and f.collection=t.value->>'collection'
 ), row_values as materialized (
  select files.collection,filename,headers,mapping,artifact_id,sha256,idkey,r.ordinality::integer-1 idx,lines->(r.ordinality::integer-1) line_,offsets->(r.ordinality::integer-1)::text offset_choice,
   mapped.current_values,mapped.original_values
  from files cross join lateral jsonb_array_elements(rows_) with ordinality r
  cross join lateral (
   select jsonb_object_agg(m.key,r.value->(h.ordinality::integer-1)) current_values,jsonb_object_agg(m.key,original_rows->(r.ordinality::integer-1)->(h.ordinality::integer-1)) original_values
   from jsonb_each_text(mapping) m join jsonb_array_elements_text(headers) with ordinality h on h.value=m.value
  ) mapped
  where not(excluded @> jsonb_build_array(r.ordinality::integer-1))
 ), row_ids as materialized (
  select *,case when idkey is null then 'csv-'||(idx+1)::text else current_values->>idkey end external from row_values
 ), records as materialized (
  select c.key collection,r.value record_ from jsonb_each(candidate) c cross join lateral jsonb_array_elements(case when c.key in ('rooms','sessions','volunteers','availability','assignments','dependencies') then c.value else '[]'::jsonb end) r
 ), origins as materialized (
  select distinct on (record_->>'id') record_->>'id' id_,row_ids.* from records join row_ids on records.collection=row_ids.collection and record_->>'external_id'=external order by record_->>'id',idx
 ), fields as (
  select fact.*,o.*,case fact.field_path when 'external_id' then idkey when 'display_name' then 'name' when 'starts_at' then 'start' when 'start_offset' then 'start' when 'ends_at' then 'end' when 'end_offset' then 'end' else fact.field_path end column_key
  from eventops_private.plan_facts(candidate) fact left join origins o on o.id_=fact.record_id
 ), columns_ as materialized (
  select fields.*,(select ordinality::integer-1 from jsonb_array_elements_text(headers) with ordinality h where h.value=mapping->>column_key) col from fields
 )
 select coalesce(jsonb_object_agg(columns_.record_id||':'||columns_.field_path,
  case when columns_.record_id='event' then jsonb_build_object('kind','event_setup','field',columns_.field_path)
  else jsonb_build_object('collection',collection,'external_id',external,'filename',filename,'file_sha256',columns_.sha256,'row',line_,'column',mapping->column_key,'column_index',col,'field',columns_.field_path,'corrected_value',current_values->column_key,'offset_choice',offset_choice,
   'kind',case when col is null then 'explicit_default_or_derived' when original_values->column_key is distinct from current_values->column_key then 'organizer_correction' when coalesce(current_values->>column_key,'')='' then 'explicit_default_or_derived' else 'csv_normalization' end,
   'original_source_id',source.id,'original_value',original_values->column_key,
   'default_notice',case when col is null or coalesce(current_values->>column_key,'')='' then 'Defaults and derived values were reviewed by the organizer' else null end)
  end),'{}')
 from columns_ left join public.source_records source on source.artifact_id=columns_.artifact_id and source.locator='csv/row/'||(line_#>>'{}')||'/column/'||(col+1)::text;
$$;
