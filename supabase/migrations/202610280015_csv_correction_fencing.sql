-- Saving a new correction fences earlier imported candidates.
create or replace function public.save_import_batch(p_event_id uuid,p_batch_id uuid,p_generation integer,p_tables jsonb,p_issues jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;b public.import_batches;t jsonb;original jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into b from public.import_batches where event_id=ev.id and id=p_batch_id for update;
 if b.id is null then raise sqlstate 'P0002' using message='Import not found';end if;
 if ev.status<>'draft' or b.generation is distinct from p_generation then raise sqlstate 'P0001' using message='Import changed';end if;
 if pg_column_size(p_tables)>12582912 or jsonb_typeof(p_tables) is distinct from 'array' or jsonb_array_length(p_tables)<>(select count(*) from public.import_files where batch_id=b.id) then raise sqlstate '22023' using message='Invalid correction';end if;
 if (select count(distinct value->>'sha256') from jsonb_array_elements(p_tables))<>jsonb_array_length(p_tables) or (select count(distinct value->>'collection') from jsonb_array_elements(p_tables))<>jsonb_array_length(p_tables) then raise sqlstate '22023' using message='Duplicate file identity';end if;
 for t in select value from jsonb_array_elements(p_tables) loop
  select original_table into original from public.import_files where batch_id=b.id and sha256=t->>'sha256';
  if exists(select 1 from jsonb_array_elements(t->'rows') row_ where jsonb_typeof(row_)<>'array' or jsonb_array_length(row_)<>jsonb_array_length(t->'headers')) then raise sqlstate '22023' using message='Invalid row width';end if;
  if original is null or original->'headers' is distinct from t->'headers' or original->'lines' is distinct from t->'lines' or original->'collection' is distinct from t->'collection' or original->'filename' is distinct from t->'filename' or jsonb_array_length(original->'rows')<>jsonb_array_length(t->'rows') then raise sqlstate '22023' using message='Original file identity cannot change';end if;
 end loop;
 if b.state='reviewed' then
  update public.plan_drafts set generation=generation+1,candidate_digest=null,validation_report=jsonb_build_array(eventops_private.issue('SHAPE',array[]::text[],'Import corrections changed. Review the latest saved batch again.')),saved_at=clock_timestamp() where event_id=ev.id and candidate_digest=b.candidate_digest;
 end if;
 update public.import_batches set tables=p_tables,validation_issues=p_issues,generation=generation+1,state='staged',candidate_digest=null,staged_snapshot=null,saved_at=clock_timestamp() where id=b.id;
 insert into public.import_versions(workspace_id,event_id,batch_id,generation,tables,actor) values(ev.workspace_id,ev.id,b.id,b.generation+1,p_tables,auth.uid());
 return jsonb_build_object('id',b.id,'generation',b.generation+1);
end $$;
