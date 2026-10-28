-- Immutable originals use the approved private object store. The bounded byte copy
-- remains a database verification receipt until retention/purge is implemented in T8.
alter table public.source_artifacts add column object_key text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-imports','event-imports',false,2097152,array['text/csv']);
create policy import_original_read on storage.objects for select to authenticated using(
 bucket_id='event-imports' and exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where w.owner_user_id=(select auth.uid()) and w.deletion_requested_at is null and e.status<>'trashed' and split_part(objects.name,'/',1)=w.id::text and split_part(objects.name,'/',2)=e.id::text)
);
create policy import_original_insert on storage.objects for insert to authenticated with check(
 bucket_id='event-imports' and exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where w.owner_user_id=(select auth.uid()) and w.deletion_requested_at is null and e.status='draft' and e.current_revision_id is null and split_part(objects.name,'/',1)=w.id::text and split_part(objects.name,'/',2)=e.id::text)
);
-- Only unreferenced failed-upload objects can be cleaned up by their owner.
create policy import_orphan_cleanup on storage.objects for delete to authenticated using(
 bucket_id='event-imports' and not exists(select 1 from public.source_artifacts a where a.object_key=objects.name) and exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where w.owner_user_id=(select auth.uid()) and w.deletion_requested_at is null and e.status='draft' and split_part(objects.name,'/',1)=w.id::text and split_part(objects.name,'/',2)=e.id::text)
);

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
  if f->>'object_key' is null or split_part(f->>'object_key','/',1)<>ev.workspace_id::text or split_part(f->>'object_key','/',2)<>ev.id::text or not exists(select 1 from storage.objects o where o.bucket_id='event-imports' and o.name=f->>'object_key') then raise sqlstate '22023' using message='Private original upload is missing';end if;
  insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,object_key,metadata) values(ev.workspace_id,ev.id,'csv',t->>'sha256',auth.uid(),f->>'object_key',jsonb_build_object('batch_id',b,'filename',t->>'filename','collection',t->>'collection','headers',t->'headers','byte_length',octet_length(raw))) returning id into artifact;
  insert into public.import_files(workspace_id,event_id,batch_id,artifact_id,collection,filename,sha256,original_bytes,original_table) values(ev.workspace_id,ev.id,b,artifact,t->>'collection',t->>'filename',t->>'sha256',raw,t);
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256)
  select ev.workspace_id,ev.id,artifact,'csv:'||artifact::text||':'||(r.ordinality-1)::text,t->'headers'->>(cell.ordinality::integer-1),'csv/row/'||(t->'lines'->>(r.ordinality::integer-1))||'/column/'||cell.ordinality::text,cell.value,eventops_private.hash(cell.value)
  from jsonb_array_elements(t->'rows') with ordinality r cross join lateral jsonb_array_elements(r.value) with ordinality cell;
 end loop;
 insert into public.import_versions(workspace_id,event_id,batch_id,generation,tables,actor) values(ev.workspace_id,ev.id,b,1,tables,auth.uid());
 return jsonb_build_object('id',b,'repeated_file',false);
end $$;
