create or replace function eventops_private.import_field_origin(tables jsonb, candidate jsonb, record_id text, field_path text, b uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare c text;record_ jsonb;t jsonb;r jsonb;original jsonb;idx integer:=0;idkey text;external text;key_ text:=field_path;col integer;artifact uuid;source uuid;raw_value jsonb;filehash text;corrected boolean;result jsonb;
begin
 if record_id='event' then return jsonb_build_object('kind','event_setup','field',field_path);end if;
 foreach c in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  select value into record_ from jsonb_array_elements(candidate->c) where value->>'id'=record_id;
  if record_ is not null then exit;end if;
 end loop;
 select value into t from jsonb_array_elements(tables) where value->>'collection'=c;
 external:=record_->>'external_id';idkey:=case c when 'rooms' then 'room_id' when 'sessions' then 'session_id' when 'volunteers' then 'volunteer_id' else null end;
 if key_='external_id' then key_:=idkey;elsif key_='display_name' then key_:='name';elsif key_ in ('starts_at','start_offset') then key_:='start';elsif key_ in ('ends_at','end_offset') then key_:='end';end if;
 for r in select value from jsonb_array_elements(t->'rows') loop
  if not(t->'excluded' @> jsonb_build_array(idx)) then
   if idkey is null then if external='csv-'||(idx+1)::text then exit;end if;
   else select ordinality::integer-1 into col from jsonb_array_elements_text(t->'headers') with ordinality where value=t->'mapping'->>idkey;
    if r->>col=external then exit;end if;
   end if;
  end if;idx:=idx+1;
 end loop;
 select f.artifact_id,f.original_table,f.sha256 into artifact,original,filehash from public.import_files f where f.batch_id=b and f.collection=c;
 select ordinality::integer-1 into col from jsonb_array_elements_text(t->'headers') with ordinality where value=t->'mapping'->>key_;
 result:=jsonb_build_object('collection',c,'external_id',external,'filename',t->>'filename','file_sha256',filehash,'row',t->'lines'->idx,'column',t->'mapping'->key_,'column_index',col,'field',field_path,'corrected_value',r->col,'offset_choice',t->'offsets'->idx::text);
 if col is null then return result||jsonb_build_object('kind','explicit_default_or_derived','default_notice','Defaults and derived values were reviewed by the organizer');end if;
 raw_value:=original->'rows'->idx->col;corrected:=raw_value is distinct from r->col;
 select s.id into source from public.source_records s where s.artifact_id=artifact and s.locator='csv/row/'||(t->'lines'->>idx)||'/column/'||(col+1)::text;
 return result||jsonb_build_object('kind',case when corrected then 'organizer_correction' when coalesce(r->>col,'')='' then 'explicit_default_or_derived' else 'csv_normalization' end,'original_source_id',source,'original_value',raw_value);
end $$;


create or replace function public.stage_import_plan(p_event_id uuid,p_batch_id uuid,p_generation integer,p_expected_draft integer,p_plan jsonb,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;b public.import_batches;result jsonb;artifact uuid;source uuid;fact record;candidate jsonb;provenance jsonb:='[]';origins jsonb;prior_plan jsonb; input_plan jsonb; c text; r jsonb; rows_ jsonb; persistent_id text; field_sources jsonb:='{}';origin jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into b from public.import_batches where event_id=ev.id and id=p_batch_id for update;
 if b.id is null then raise sqlstate 'P0002' using message='Import not found';end if;
 if b.generation is distinct from p_generation or p_confirmed is distinct from true then raise sqlstate 'P0001' using message='Import changed';end if;
 if p_plan is distinct from eventops_private.import_input(b.tables) then raise sqlstate '22023' using message='Import plan differs from saved corrections';end if;
 select plan_snapshot into prior_plan from public.plan_drafts where event_id=ev.id;
 input_plan:=p_plan;
 foreach c in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  rows_:='[]';
  for r in select value from jsonb_array_elements(input_plan->c) loop
   select value->>'id' into persistent_id from jsonb_array_elements(coalesce(prior_plan->c,'[]')) where value->>'external_id'=r->>'external_id';
   if persistent_id is not null then r:=r||jsonb_build_object('id',persistent_id);end if;
   rows_:=rows_||jsonb_build_array(r);
  end loop;input_plan:=jsonb_set(input_plan,array[c],rows_);
 end loop;
 result:=public.stage_plan(ev.id,input_plan,p_expected_draft,true);
 candidate:=result->'snapshot';
 select jsonb_agg(jsonb_build_object('artifact_id',artifact_id,'filename',filename,'collection',collection)) into origins from public.import_files where batch_id=b.id;
 for fact in select * from eventops_private.plan_facts(candidate) loop
  origin:=eventops_private.import_field_origin(b.tables,candidate,fact.record_id,fact.field_path,b.id);
  field_sources:=field_sources||jsonb_build_object(fact.record_id||':'||fact.field_path,origin);
 end loop;
 -- Normalized facts are organizer assertions, linked to exact immutable CSV originals
 -- and the append only correction generation. Raw strings are retained separately.
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',eventops_private.hash(candidate),auth.uid(),jsonb_build_object('operation','csv_review','batch_id',b.id,'generation',b.generation,'original_files',origins,'field_sources',field_sources)) returning id into artifact;
 for fact in select * from eventops_private.plan_facts(candidate) loop
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,fact.record_id,fact.field_path,'csv-review/'||b.id::text||'/generation/'||b.generation::text||'/row/'||coalesce(field_sources->(fact.record_id||':'||fact.field_path)->>'row','setup')||'/column/'||coalesce(field_sources->(fact.record_id||':'||fact.field_path)->>'column','default')||'/'||fact.field_path,fact.value_json,eventops_private.hash(fact.value_json)) returning id into source;
  provenance:=provenance||jsonb_build_array(jsonb_build_object('record_id',fact.record_id,'field_path',fact.field_path,'source_record_ids',jsonb_build_array(source),'derivation_kind','manual'));
 end loop;
 candidate:=jsonb_set(candidate,'{provenance}',provenance);
 update public.plan_drafts set plan_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where event_id=ev.id;
 update public.import_batches set state='reviewed',draft_generation=(result->>'generation')::integer,staged_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where id=b.id;
 return result||jsonb_build_object('snapshot',candidate,'candidate_digest',eventops_private.hash(candidate));
end $$;
