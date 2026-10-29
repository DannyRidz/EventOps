-- Accumulate records in native arrays, then serialize once per collection.
-- Preserve all limits, identity, timezone, duplicate and reference validation.
CREATE OR REPLACE FUNCTION eventops_private.import_input(tables jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:='{"rooms":[],"sessions":[],"volunteers":[],"availability":[],"assignments":[],"dependencies":[]}';t jsonb;cells jsonb;values_ jsonb;r jsonb;rows_ jsonb[];c text;k text;v text;f record;i integer;first_i integer;identity text;idkey text;seen jsonb;seen_rows jsonb;map jsonb;fields text[];required text[];duplicate_key text;session_ jsonb;
begin
 for t in select value from jsonb_array_elements(tables) loop
  c:=t->>'collection';map:=t->'mapping';rows_:='{}';seen:='{}';seen_rows:='{}';
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
   rows_:=array_append(rows_,r);i:=i+1;
  end loop;
  result:=jsonb_set(result,array[c],to_jsonb(rows_));
 end loop;
 rows_:='{}';
 for r in select value from jsonb_array_elements(result->'assignments') loop
  select value into session_ from jsonb_array_elements(result->'sessions') where value->>'external_id'=r->>'session_id';
  foreach k in array array['start','end'] loop if r->>k='' then r:=jsonb_set(r,array[k],coalesce(session_->k,'""'::jsonb));end if;end loop;
  rows_:=array_append(rows_,r);
 end loop;
 return jsonb_set(result,'{assignments}',to_jsonb(rows_));
end $function$;

CREATE OR REPLACE FUNCTION eventops_private.normalize_plan(p jsonb, prior jsonb, setup jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb; names text[]:=array['rooms','sessions','volunteers','availability','assignments','dependencies']; limits integer[]:=array[20,100,100,1000,500,100]; name text; r jsonb; rows jsonb[]; ids jsonb:='{}'; prior_ids text[]; record_id text; ref text; target text; linked jsonb; index integer; allowed text[];
begin
 if p is null or jsonb_typeof(p)<>'object' or (p ? 'schema_version' and p->'schema_version'<>'1'::jsonb) or pg_column_size(p)>4194304 or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['schema_version','event','rooms','sessions','volunteers','availability','assignments','dependencies','provenance'])) then raise sqlstate '22023' using message='Invalid plan fields or size'; end if;
 result:=jsonb_build_object('schema_version',1,'event',setup||eventops_private.resolve_interval(setup,setup),'provenance','[]'::jsonb);
 for index in 1..6 loop
  name:=names[index];
  if jsonb_typeof(p->name) is distinct from 'array' or jsonb_array_length(p->name)>limits[index] then raise sqlstate '22023' using message='Invalid record collection or limit'; end if;
  select array_agg(value->>'id') into prior_ids from jsonb_array_elements(coalesce(prior->name,'[]'));
  rows:='{}';
  for r in select value from jsonb_array_elements(p->name) loop
   if jsonb_typeof(r)<>'object' or jsonb_typeof(r->'external_id') is distinct from 'string' or length(r->>'external_id') not between 1 and 64 then raise sqlstate '22023' using message='Every record needs an external identifier'; end if;
   if ids ? (name||':'||(r->>'external_id')) then raise sqlstate '22023' using message='Duplicate external identifier'; end if;
   if r ? 'id' then
    record_id:=r->>'id';
    if record_id is null or not coalesce(record_id=any(prior_ids),false) then raise sqlstate '22023' using message='Unknown persistent record identifier'; end if;
   else record_id:=gen_random_uuid()::text;
   end if;
   if ids ? (name||':'||record_id) and ids->>(name||':'||record_id)<>record_id then raise sqlstate '22023' using message='Ambiguous record alias';end if;
   ids:=ids||jsonb_build_object(name||':'||(r->>'external_id'),record_id,name||':'||record_id,record_id);
   rows:=array_append(rows,r||jsonb_build_object('id',record_id));
  end loop;
  result:=result||jsonb_build_object(name,to_jsonb(rows));
 end loop;
 foreach name in array names loop
  rows:='{}';
  for r in select value from jsonb_array_elements(result->name) loop
   allowed:=case name
    when 'rooms' then array['id','external_id','name','location','capacity','feature_tags']
    when 'sessions' then array['id','external_id','title','start','end','starts_at','ends_at','start_offset','end_offset','room_id','required_volunteers','expected_attendance','required_role_tag','required_feature_tags','setup_minutes','teardown_minutes']
    when 'volunteers' then array['id','external_id','display_name','role_tags','active']
    when 'availability' then array['id','external_id','volunteer_id','start','end','starts_at','ends_at','start_offset','end_offset','status']
    when 'assignments' then array['id','external_id','volunteer_id','session_id','role_tag','start','end','starts_at','ends_at','start_offset','end_offset']
    else array['id','external_id','predecessor_session_id','successor_session_id','minimum_gap_minutes'] end;
   if exists(select 1 from jsonb_object_keys(r) k where k<>all(allowed)) then raise sqlstate '22023' using message='Unsupported record field'; end if;
   foreach ref in array array['room_id','volunteer_id','session_id','predecessor_session_id','successor_session_id'] loop
    if r ? ref then
     target:=case when ref='room_id' then 'rooms' when ref='volunteer_id' then 'volunteers' else 'sessions' end;
     if not ids ? (target||':'||(r->>ref)) then raise sqlstate '22023' using message='Referenced record does not exist'; end if;
     r:=jsonb_set(r,array[ref],ids->(target||':'||(r->>ref)));
    end if;
   end loop;
   if name='assignments' and not (r ? 'start' or r ? 'end') then
    select value into linked from jsonb_array_elements(result->'sessions') where value->>'id'=r->>'session_id';
    r:=r||jsonb_build_object('start',linked->'start','end',linked->'end','start_offset',linked->'start_offset','end_offset',linked->'end_offset');
   end if;
   if name in ('sessions','availability','assignments') then r:=r||eventops_private.resolve_interval_in_known_zone(r,setup); end if;
   rows:=array_append(rows,r);
  end loop;
  result:=jsonb_set(result,array[name],to_jsonb(rows));
 end loop;
 if eventops_private.plan_shape_valid(result) is distinct from true then raise sqlstate '22023' using message='Plan fields or limits do not match the schema'; end if;
 return result;
end $function$;
