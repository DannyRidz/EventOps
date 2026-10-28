-- Bounded private originals and append only correction receipts. No public object URL.
create table public.import_batches (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, event_id uuid not null,
 generation integer not null default 1, draft_generation integer not null, state text not null default 'staged' check(state in ('staged','reviewed','confirmed')),
 tables jsonb not null, validation_issues jsonb not null default '[]', staged_snapshot jsonb, candidate_digest text, revision_id uuid,
 created_at timestamptz not null default now(), saved_at timestamptz not null default now(),
 unique(workspace_id,event_id,id), foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
create table public.import_files (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null,event_id uuid not null,batch_id uuid not null,
 artifact_id uuid not null, collection text not null, filename text not null, sha256 text not null,
 original_bytes bytea not null check(octet_length(original_bytes)<=2097152), original_table jsonb not null,
 created_at timestamptz not null default now(),
 unique(event_id,sha256), foreign key(workspace_id,event_id,batch_id) references public.import_batches(workspace_id,event_id,id),
 foreign key(workspace_id,event_id,artifact_id) references public.source_artifacts(workspace_id,event_id,id)
);
create table public.import_versions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,batch_id uuid not null,
 generation integer not null,tables jsonb not null,actor uuid not null references public.profiles(user_id),created_at timestamptz not null default now(),
 unique(batch_id,generation),foreign key(workspace_id,event_id,batch_id) references public.import_batches(workspace_id,event_id,id)
);
alter table public.source_artifacts drop constraint source_artifacts_kind_check;
alter table public.source_artifacts add constraint source_artifacts_kind_check check(kind in ('manual','csv'));
do $$ declare t text;begin foreach t in array array['import_batches','import_files','import_versions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_records on public.%I for select to authenticated using(workspace_id in(select id from public.workspaces where owner_user_id=(select auth.uid()) and deletion_requested_at is null) and event_id in(select id from public.events where status<>''trashed''))',t);
 end loop;
 foreach t in array array['import_files','import_versions'] loop execute format('create trigger immutable_record before update on public.%I for each row execute function eventops_private.immutable_record()',t);end loop;
end $$;
create function public.create_import_batch(p_event_id uuid,p_expected_generation integer,p_files jsonb) returns jsonb
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
create function public.save_import_batch(p_event_id uuid,p_batch_id uuid,p_generation integer,p_tables jsonb,p_issues jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;b public.import_batches;t jsonb;original jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into b from public.import_batches where event_id=ev.id and id=p_batch_id for update;
 if b.id is null then raise sqlstate 'P0002' using message='Import not found';end if;
 if ev.status<>'draft' or b.generation is distinct from p_generation then raise sqlstate 'P0001' using message='Import changed';end if;
 if pg_column_size(p_tables)>12582912 or jsonb_typeof(p_tables) is distinct from 'array' or jsonb_array_length(p_tables)<>(select count(*) from public.import_files where batch_id=b.id) then raise sqlstate '22023' using message='Invalid correction';end if;
 for t in select value from jsonb_array_elements(p_tables) loop
  select original_table into original from public.import_files where batch_id=b.id and sha256=t->>'sha256';
  if original is null or original->'headers' is distinct from t->'headers' or original->'lines' is distinct from t->'lines' or original->'collection' is distinct from t->'collection' or original->'filename' is distinct from t->'filename' or jsonb_array_length(original->'rows')<>jsonb_array_length(t->'rows') then raise sqlstate '22023' using message='Original file identity cannot change';end if;
 end loop;
 update public.import_batches set tables=p_tables,validation_issues=p_issues,generation=generation+1,state='staged',candidate_digest=null,staged_snapshot=null,saved_at=clock_timestamp() where id=b.id;
 insert into public.import_versions(workspace_id,event_id,batch_id,generation,tables,actor) values(ev.workspace_id,ev.id,b.id,b.generation+1,p_tables,auth.uid());
 return jsonb_build_object('id',b.id,'generation',b.generation+1);
end $$;
create function eventops_private.import_input(tables jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb:='{"rooms":[],"sessions":[],"volunteers":[],"availability":[],"assignments":[],"dependencies":[]}';t jsonb;cells jsonb;values_ jsonb;r jsonb;rows_ jsonb;c text;k text;v text;f record;i integer;first_i integer;identity text;idkey text;seen jsonb;seen_rows jsonb;map jsonb;fields text[];required text[];duplicate_key text;session_ jsonb;
begin
 for t in select value from jsonb_array_elements(tables) loop
  c:=t->>'collection';map:=t->'mapping';rows_:='[]';seen:='{}';seen_rows:='{}';
  required:=case c when 'rooms' then array['room_id','name','location'] when 'sessions' then array['session_id','title','start','end','room_id','required_volunteers'] when 'volunteers' then array['volunteer_id','name'] when 'availability' then array['volunteer_id','start','end','status'] when 'assignments' then array['session_id','volunteer_id','role_tag'] when 'dependencies' then array['predecessor_session_id','successor_session_id','minimum_gap_minutes'] else null end;
  if required is null or exists(select 1 from unnest(required) h where not(map ? h)) then raise sqlstate '22023' using message='Missing import mapping';end if;
  idkey:=case c when 'rooms' then 'room_id' when 'sessions' then 'session_id' when 'volunteers' then 'volunteer_id' else null end;
  fields:=case c when 'rooms' then array['name','location','capacity','feature_tags'] when 'sessions' then array['title','start','end','room_id','required_volunteers','expected_attendance','required_role_tag','required_feature_tags','setup_minutes','teardown_minutes'] when 'volunteers' then array['name','role_tags','active'] when 'availability' then array['volunteer_id','start','end','status'] when 'assignments' then array['session_id','volunteer_id','role_tag','start','end'] else required end;
  i:=0;
  for cells in select value from jsonb_array_elements(t->'rows') loop
   if t->'excluded' @> jsonb_build_array(i) then i:=i+1;continue;end if;
   values_:='{}';
   for f in select key,value from jsonb_each_text(map) loop
    -- Extract text without JSON quoting.
    select cells->>(ordinality::integer-1) into v from jsonb_array_elements_text(t->'headers') with ordinality where value=f.value;
    if v is null then raise sqlstate '22023' using message='Invalid mapping';end if;
    values_:=values_||jsonb_build_object(f.key,v);
   end loop;
   identity:=case when idkey is null then values_::text else values_->>idkey end;
   if seen ? identity then
    if seen->identity<>values_ then raise sqlstate '22023' using message='Conflicting duplicate';end if;
    first_i:=(seen_rows->>identity)::integer;
    duplicate_key:=case when idkey is null then 'row:'||(first_i+1)::text else identity end;
    if not(t->'keep_one' ? duplicate_key) then raise sqlstate '22023' using message='Duplicate decision required';end if;
    i:=i+1;continue;
   end if;
   seen:=seen||jsonb_build_object(identity,values_);seen_rows:=seen_rows||jsonb_build_object(identity,i);
   r:=jsonb_build_object('external_id',case when idkey is null then 'csv-'||(i+1)::text else values_->>idkey end);
   foreach k in array fields loop
    v:=coalesce(values_->>k,'');
    if k=any(array['capacity','required_volunteers','expected_attendance','setup_minutes','teardown_minutes','minimum_gap_minutes']) then
     if btrim(v)='' and k=any(array['capacity','expected_attendance']) then r:=r||jsonb_build_object(k,null);
     elsif btrim(v)='' and k=any(array['setup_minutes','teardown_minutes']) then r:=r||jsonb_build_object(k,0);
     else if btrim(v)!~'^[0-9]+$' then raise sqlstate '22023' using message='Invalid import integer';end if;r:=r||jsonb_build_object(k,v::integer);end if;
    elsif k=any(array['feature_tags','role_tags','required_feature_tags']) then r:=r||jsonb_build_object(k,coalesce((select jsonb_agg(btrim(tag)) from unnest(string_to_array(v,';')) tag where btrim(tag)<>''),'[]'::jsonb));
    elsif k='active' then if btrim(v)<>all(array['','true','false']) then raise sqlstate '22023' using message='Invalid active value';end if;r:=r||jsonb_build_object(k,btrim(v)<>'false');
    elsif k='required_role_tag' then r:=r||jsonb_build_object(k,nullif(btrim(v),''));
    else r:=r||jsonb_build_object(case when k='name' and c='volunteers' then 'display_name' else k end,case when k like '%\_id' then v else btrim(v) end);end if;
   end loop;
   foreach k in array array['start','end'] loop if coalesce(t->'offsets'->i::text->>k,'')<>'' then r:=r||jsonb_build_object(k||'_offset',t->'offsets'->i::text->>k);end if;end loop;
   rows_:=rows_||jsonb_build_array(r);i:=i+1;
  end loop;
  result:=jsonb_set(result,array[c],rows_);
 end loop;
 rows_:='[]';
 for r in select value from jsonb_array_elements(result->'assignments') loop
  select value into session_ from jsonb_array_elements(result->'sessions') where value->>'external_id'=r->>'session_id';
  foreach k in array array['start','end'] loop if r->>k='' then r:=jsonb_set(r,array[k],coalesce(session_->k,'""'::jsonb));end if;end loop;
  rows_:=rows_||jsonb_build_array(r);
 end loop;
 return jsonb_set(result,'{assignments}',rows_);
end $$;

create function public.stage_import_plan(p_event_id uuid,p_batch_id uuid,p_generation integer,p_expected_draft integer,p_plan jsonb,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;b public.import_batches;result jsonb;artifact uuid;source uuid;fact record;candidate jsonb;provenance jsonb:='[]';origins jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into b from public.import_batches where event_id=ev.id and id=p_batch_id for update;
 if b.id is null then raise sqlstate 'P0002' using message='Import not found';end if;
 if b.generation is distinct from p_generation or p_confirmed is distinct from true then raise sqlstate 'P0001' using message='Import changed';end if;
 if p_plan is distinct from eventops_private.import_input(b.tables) then raise sqlstate '22023' using message='Import plan differs from saved corrections';end if;
 result:=public.stage_plan(ev.id,p_plan,p_expected_draft,true);
 candidate:=result->'snapshot';
 select jsonb_agg(jsonb_build_object('artifact_id',artifact_id,'filename',filename,'collection',collection)) into origins from public.import_files where batch_id=b.id;
 -- Normalized facts are organizer assertions, linked to exact immutable CSV originals
 -- and the append only correction generation. Raw strings are retained separately.
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(ev.workspace_id,ev.id,'manual',eventops_private.hash(candidate),auth.uid(),jsonb_build_object('operation','csv_review','batch_id',b.id,'generation',b.generation,'original_files',origins)) returning id into artifact;
 for fact in select * from eventops_private.plan_facts(candidate) loop
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(ev.workspace_id,ev.id,artifact,fact.record_id,fact.field_path,'csv-review/'||b.id::text||'/generation/'||b.generation::text||'/'||fact.record_id||'/'||fact.field_path,fact.value_json,eventops_private.hash(fact.value_json)) returning id into source;
  provenance:=provenance||jsonb_build_array(jsonb_build_object('record_id',fact.record_id,'field_path',fact.field_path,'source_record_ids',jsonb_build_array(source),'derivation_kind','manual'));
 end loop;
 candidate:=jsonb_set(candidate,'{provenance}',provenance);
 update public.plan_drafts set plan_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where event_id=ev.id;
 update public.import_batches set state='reviewed',draft_generation=(result->>'generation')::integer,staged_snapshot=candidate,candidate_digest=eventops_private.hash(candidate) where id=b.id;
 return result||jsonb_build_object('snapshot',candidate,'candidate_digest',eventops_private.hash(candidate));
end $$;
-- Link the exact batch to revision 1 inside the existing confirmation transaction.
create function eventops_private.confirm_import_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if new.operation='confirm' then update public.import_batches set state='confirmed',revision_id=new.revision_id where event_id=new.event_id and candidate_digest=new.candidate_digest and state='reviewed';end if;return new;
end $$;
create trigger confirm_import_receipt after insert on public.approval_receipts for each row execute function eventops_private.confirm_import_receipt();
revoke all on function public.create_import_batch(uuid,integer,jsonb),public.save_import_batch(uuid,uuid,integer,jsonb,jsonb),public.stage_import_plan(uuid,uuid,integer,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.create_import_batch(uuid,integer,jsonb),public.save_import_batch(uuid,uuid,integer,jsonb,jsonb),public.stage_import_plan(uuid,uuid,integer,integer,jsonb,boolean) to authenticated;
