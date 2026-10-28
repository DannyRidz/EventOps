-- The authenticated RPC is an input boundary too. Reparse originals in PostgreSQL.
create function eventops_private.parse_import_csv(raw bytea) returns jsonb language plpgsql set search_path='' as $$
declare content text;chars text[];c text;i integer:=1;line integer:=1;first_line integer:=1;cell text:='';row_ jsonb:='[]';rows_ jsonb:='[]';lines_ jsonb:='[]';headers jsonb;quoted boolean:=false;closed boolean:=false;finish boolean;
begin
 if octet_length(raw)>2097152 then raise sqlstate '22023' using message='File exceeds limit';end if;
 content:=convert_from(raw,'UTF8');if left(content,1)=chr(65279) then content:=substr(content,2);end if;
 chars:=string_to_array(content,null);
 while i<=coalesce(cardinality(chars),0) loop
  c:=chars[i];finish:=false;
  if quoted then
   if c='"' then if chars[i+1]='"' then cell:=cell||'"';i:=i+1;else quoted:=false;closed:=true;end if;
   else cell:=cell||c;if c=E'\n' then line:=line+1;end if;end if;
  elsif c=',' then
   row_:=row_||jsonb_build_array(cell);cell:='';closed:=false;
  elsif c=E'\r' or c=E'\n' then
   if c=E'\r' then if chars[i+1] is distinct from E'\n' then raise sqlstate '22023' using message='Invalid line ending';end if;i:=i+1;end if;
   finish:=true;
  elsif c='"' and cell='' and not closed then quoted:=true;
  else if closed or c='"' then raise sqlstate '22023' using message='Invalid quoting';end if;cell:=cell||c;
  end if;
  if length(cell)>4096 or jsonb_array_length(row_)>32 then raise sqlstate '22023' using message='Cell or column limit';end if;
  if finish then
   row_:=row_||jsonb_build_array(cell);rows_:=rows_||jsonb_build_array(row_);lines_:=lines_||jsonb_build_array(first_line);cell:='';row_:='[]';closed:=false;line:=line+1;first_line:=line;
   if jsonb_array_length(rows_)>2002 then raise sqlstate '22023' using message='Row limit';end if;
  end if;i:=i+1;
 end loop;
 if quoted then raise sqlstate '22023' using message='Unclosed quote';end if;
 if cell<>'' or row_<>'[]'::jsonb or closed then rows_:=rows_||jsonb_build_array(row_||jsonb_build_array(cell));lines_:=lines_||jsonb_build_array(first_line);end if;
 headers:=rows_->0;
 if headers is null or jsonb_array_length(headers)>32 or exists(select 1 from jsonb_array_elements_text(headers) h where btrim(h)='') or (select count(distinct h) from jsonb_array_elements_text(headers) h)<>jsonb_array_length(headers) or exists(select 1 from jsonb_array_elements(rows_ - 0) r where jsonb_array_length(r)<>jsonb_array_length(headers)) then raise sqlstate '22023' using message='Invalid CSV headers or row width';end if;
 return jsonb_build_object('headers',headers,'rows',rows_-0,'lines',lines_-0);
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
  ri:=0;
  for row_data in select value from jsonb_array_elements(t->'rows') loop
   ci:=0;
   for cell in select value from jsonb_array_elements(row_data) loop
    insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,'csv:'||artifact::text||':'||ri::text,t->'headers'->>ci,'csv/row/'||(t->'lines'->>ri)||'/column/'||(ci+1)::text,cell,eventops_private.hash(cell));ci:=ci+1;
   end loop;ri:=ri+1;
  end loop;
 end loop;
 insert into public.import_versions(workspace_id,event_id,batch_id,generation,tables,actor) values(ev.workspace_id,ev.id,b,1,tables,auth.uid());
 return jsonb_build_object('id',b,'repeated_file',false);
end $$;
