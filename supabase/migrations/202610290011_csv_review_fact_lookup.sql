-- Expand the bounded evidence locator map once and join each unique key.
-- Preserve exact locators, defaults, hashes, locks and whole-plan validation.
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
 with field_origins as materialized (
  select key,value from jsonb_each(field_sources)
 ), captured as (
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256)
  select ev.workspace_id,ev.id,artifact,f.record_id,f.field_path,'csv-review/'||b.id::text||'/generation/'||b.generation::text||'/row/'||coalesce(o.value->>'row','setup')||'/column/'||coalesce(o.value->>'column','default')||'/'||f.field_path,f.value_json,eventops_private.hash(f.value_json) from eventops_private.plan_facts(candidate) f left join field_origins o on o.key=f.record_id||':'||f.field_path returning id,record_id,field_path
 ) select jsonb_agg(jsonb_build_object('record_id',record_id,'field_path',field_path,'source_record_ids',jsonb_build_array(id),'derivation_kind','manual') order by record_id,field_path) into provenance from captured;
 candidate:=jsonb_set(candidate,'{provenance}',provenance);
 update public.plan_drafts set plan_snapshot=candidate,candidate_digest=eventops_private.hash(candidate),validation_report=report,generation=generation+1,saved_at=clock_timestamp() where event_id=ev.id;
 update public.import_batches set state='reviewed',draft_generation=draft.generation+1,staged_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where id=b.id;
 return jsonb_build_object('snapshot',candidate,'candidate_digest',eventops_private.hash(candidate),'generation',draft.generation+1,'validation_report',report,'validator_version','plan-v1');
end $$;

