create index source_records_artifact_locator on public.source_records(artifact_id,locator);
create function eventops_private.import_field_sources(tables jsonb,candidate jsonb,b uuid) returns jsonb language sql stable set search_path='' as $$
 with file_rows as materialized (
  select t.value t,f.original_table,f.artifact_id,f.sha256,r.value cells,r.ordinality::integer-1 idx,
    case t.value->>'collection' when 'rooms' then 'room_id' when 'sessions' then 'session_id' when 'volunteers' then 'volunteer_id' end idkey
  from jsonb_array_elements(tables) t join public.import_files f on f.batch_id=b and f.collection=t.value->>'collection'
  cross join lateral jsonb_array_elements(t.value->'rows') with ordinality r
  where not(t.value->'excluded' @> jsonb_build_array(r.ordinality::integer-1))
 ), row_ids as materialized (
  select *,case when idkey is null then 'csv-'||(idx+1)::text else cells->>(select ordinality::integer-1 from jsonb_array_elements_text(t->'headers') with ordinality h where h.value=t->'mapping'->>idkey) end external
  from file_rows
 ), records as materialized (
  select c.key collection,r.value record_ from jsonb_each(candidate) c cross join lateral jsonb_array_elements(case when c.key in ('rooms','sessions','volunteers','availability','assignments','dependencies') then c.value else '[]'::jsonb end) r
 ), origins as materialized (
  select distinct on (record_->>'id') records.*,row_ids.* from records join row_ids on collection=t->>'collection' and record_->>'external_id'=external order by record_->>'id',idx
 ), fields as (
  select fact.*,o.*,case fact.field_path when 'external_id' then idkey when 'display_name' then 'name' when 'starts_at' then 'start' when 'start_offset' then 'start' when 'ends_at' then 'end' when 'end_offset' then 'end' else fact.field_path end column_key
  from eventops_private.plan_facts(candidate) fact left join origins o on o.record_->>'id'=fact.record_id
 ), columns_ as materialized (
  select fields.*,(select ordinality::integer-1 from jsonb_array_elements_text(t->'headers') with ordinality h where h.value=t->'mapping'->>column_key) col from fields
 )
 select coalesce(jsonb_object_agg(columns_.record_id||':'||columns_.field_path,
  case when columns_.record_id='event' then jsonb_build_object('kind','event_setup','field',columns_.field_path)
  else jsonb_build_object('collection',collection,'external_id',external,'filename',t->>'filename','file_sha256',columns_.sha256,'row',t->'lines'->idx,'column',t->'mapping'->column_key,'column_index',col,'field',columns_.field_path,'corrected_value',cells->col,'offset_choice',t->'offsets'->idx::text,
   'kind',case when col is null then 'explicit_default_or_derived' when original_table->'rows'->idx->col is distinct from cells->col then 'organizer_correction' when coalesce(cells->>col,'')='' then 'explicit_default_or_derived' else 'csv_normalization' end,
   'original_source_id',source.id,'original_value',original_table->'rows'->idx->col,
   'default_notice',case when col is null or coalesce(cells->>col,'')='' then 'Defaults and derived values were reviewed by the organizer' else null end)
  end),'{}')
 from columns_ left join public.source_records source on source.artifact_id=columns_.artifact_id and source.locator='csv/row/'||(t->'lines'->>idx)||'/column/'||(col+1)::text;
$$;
create or replace function public.stage_import_plan(p_event_id uuid,p_batch_id uuid,p_generation integer,p_expected_draft integer,p_plan jsonb,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;b public.import_batches;draft public.plan_drafts;artifact uuid;candidate jsonb;provenance jsonb;origins jsonb;field_sources jsonb;prior_plan jsonb;input_plan jsonb;c text;r jsonb;rows_ jsonb;persistent_id text;report jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into b from public.import_batches where event_id=ev.id and id=p_batch_id for update;
 if b.id is null then raise sqlstate 'P0002' using message='Import not found';end if;
 if ev.status<>'draft' or ev.current_revision_id is not null or b.generation is distinct from p_generation or p_confirmed is distinct from true then raise sqlstate 'P0001' using message='Import changed';end if;
 select * into draft from public.plan_drafts where event_id=ev.id for update;
 if p_expected_draft is distinct from draft.generation then raise sqlstate 'P0001' using message='Draft changed';end if;
 if p_plan is distinct from eventops_private.import_input(b.tables) then raise sqlstate '22023' using message='Import plan differs from saved corrections';end if;
 prior_plan:=draft.plan_snapshot;input_plan:=p_plan;
 foreach c in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  rows_:='[]';
  for r in select value from jsonb_array_elements(input_plan->c) loop
   select value->>'id' into persistent_id from jsonb_array_elements(coalesce(prior_plan->c,'[]')) where value->>'external_id'=r->>'external_id';
   if persistent_id is not null then r:=r||jsonb_build_object('id',persistent_id);end if;
   rows_:=rows_||jsonb_build_array(r);
  end loop;input_plan:=jsonb_set(input_plan,array[c],rows_);
 end loop;
 candidate:=eventops_private.normalize_plan(input_plan,prior_plan,draft.snapshot);
 report:=eventops_private.validate_plan(candidate);
 select jsonb_agg(jsonb_build_object('artifact_id',artifact_id,'filename',filename,'collection',collection)) into origins from public.import_files where batch_id=b.id;
 field_sources:=eventops_private.import_field_sources(b.tables,candidate,b.id);
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',eventops_private.hash(candidate),auth.uid(),jsonb_build_object('operation','csv_review','batch_id',b.id,'generation',b.generation,'original_files',origins,'field_sources',field_sources)) returning id into artifact;
 with captured as (
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256)
  select ev.workspace_id,ev.id,artifact,f.record_id,f.field_path,'csv-review/'||b.id::text||'/generation/'||b.generation::text||'/row/'||coalesce(field_sources->(f.record_id||':'||f.field_path)->>'row','setup')||'/column/'||coalesce(field_sources->(f.record_id||':'||f.field_path)->>'column','default')||'/'||f.field_path,f.value_json,eventops_private.hash(f.value_json) from eventops_private.plan_facts(candidate) f returning id,record_id,field_path
 ) select jsonb_agg(jsonb_build_object('record_id',record_id,'field_path',field_path,'source_record_ids',jsonb_build_array(id),'derivation_kind','manual') order by record_id,field_path) into provenance from captured;
 candidate:=jsonb_set(candidate,'{provenance}',provenance);
 update public.plan_drafts set plan_snapshot=candidate,candidate_digest=eventops_private.hash(candidate),validation_report=report,generation=generation+1,saved_at=clock_timestamp() where event_id=ev.id;
 update public.import_batches set state='reviewed',draft_generation=draft.generation+1,staged_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where id=b.id;
 return jsonb_build_object('snapshot',candidate,'candidate_digest',eventops_private.hash(candidate),'generation',draft.generation+1,'validation_report',report,'validator_version','plan-v1');
end $$;

create or replace function public.create_import_batch(p_event_id uuid,p_expected_generation integer,p_files jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.plan_drafts;b uuid;f jsonb;t jsonb;tables jsonb:='[]';raw bytea;hash text;artifact uuid;prior uuid;total integer:=0;cell jsonb;row_data jsonb;ri integer;ci integer;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.status<>'draft' or ev.current_revision_id is not null then raise sqlstate 'P0001' using message='Use a proposal for approved plans';end if;
 select * into draft from public.plan_drafts where event_id=ev.id for update;
 if p_expected_generation is distinct from draft.generation then raise sqlstate 'P0001' using message='Draft changed';end if;
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files) not between 1 and 6 then raise sqlstate '22023' using message='Invalid file count';end if;
 -- A repeated hash offers its original batch. Nothing from this request is inserted.
 for f in select value from jsonb_array_elements(p_files) loop
  raw:=decode(f->>'bytes','base64');total:=total+octet_length(raw);hash:=encode(extensions.digest(raw,'sha256'),'hex');
  if octet_length(raw)>2097152 or total>10485760 or hash is distinct from f->'table'->>'sha256' or length(f->'table'->>'filename') not between 1 and 240 or jsonb_typeof(f->'table'->'rows') is distinct from 'array' or jsonb_array_length(f->'table'->'rows')>2001 then raise sqlstate '22023' using message='Invalid file';end if;
  select batch_id into prior from public.import_files where event_id=ev.id and sha256=hash;
  if prior is not null then return jsonb_build_object('id',prior,'repeated_file',true);end if;
  if eventops_private.parse_import_csv(raw) is distinct from jsonb_build_object('headers',f->'table'->'headers','rows',f->'table'->'rows','lines',f->'table'->'lines') then raise sqlstate '22023' using message='CSV parsed values differ from original bytes';end if;
  tables:=tables||jsonb_build_array(f->'table');
 end loop;
 if (select count(distinct value->>'collection') from jsonb_array_elements(tables))<>jsonb_array_length(tables) then raise sqlstate '22023' using message='Duplicate template';end if;
 if (select count(*) from public.import_batches where event_id=ev.id and created_at>now()-interval '1 hour')>=10 then raise sqlstate 'P0001' using message='Import limit reached';end if;
 insert into public.import_batches(workspace_id,event_id,draft_generation,tables) values(ev.workspace_id,ev.id,draft.generation,tables) returning id into b;
 for f in select value from jsonb_array_elements(p_files) loop
  t:=f->'table';raw:=decode(f->>'bytes','base64');
  insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'csv',t->>'sha256',auth.uid(),jsonb_build_object('batch_id',b,'filename',t->>'filename','collection',t->>'collection','headers',t->'headers','byte_length',octet_length(raw))) returning id into artifact;
  insert into public.import_files(workspace_id,event_id,batch_id,artifact_id,collection,filename,sha256,original_bytes,original_table) values(ev.workspace_id,ev.id,b,artifact,t->>'collection',t->>'filename',t->>'sha256',raw,t);
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256)
  select ev.workspace_id,ev.id,artifact,'csv:'||artifact::text||':'||(r.ordinality-1)::text,t->'headers'->>(cell.ordinality::integer-1),'csv/row/'||(t->'lines'->>(r.ordinality::integer-1))||'/column/'||cell.ordinality::text,cell.value,eventops_private.hash(cell.value)
  from jsonb_array_elements(t->'rows') with ordinality r cross join lateral jsonb_array_elements(r.value) with ordinality cell;
 end loop;
 insert into public.import_versions(workspace_id,event_id,batch_id,generation,tables,actor) values(ev.workspace_id,ev.id,b,1,tables,auth.uid());
 return jsonb_build_object('id',b,'repeated_file',false);
end $$;
