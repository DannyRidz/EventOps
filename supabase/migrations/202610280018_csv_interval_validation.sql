-- Check IANA membership once per plan, retaining full per-interval date, offset and fold checks.
-- The helper is private. All callers first validate the event through resolve_interval.
create function eventops_private.resolve_interval_in_known_zone(p jsonb, e jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare edge text; local_stamp timestamp; resolved timestamptz; choices timestamptz[]; result jsonb:='{}'; offset_text text; offset_seconds integer; zone text:=e->>'timezone';
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(e->'date') is distinct from 'string' or jsonb_typeof(e->'timezone') is distinct from 'string' then raise sqlstate '22023' using message='Invalid interval timezone'; end if;
 foreach edge in array array['start','end'] loop
  if jsonb_typeof(p->edge) is distinct from 'string' or (p->>edge) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise sqlstate '22023' using message='Use HH:mm times'; end if;
  local_stamp:=((e->>'date')||'T'||(p->>edge))::timestamp;
  offset_text:=p->>(edge||'_offset');
  if offset_text is not null then
   if jsonb_typeof(p->(edge||'_offset')) is distinct from 'string' or offset_text !~ '^[+-]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise sqlstate '22023' using message='Invalid UTC offset'; end if;
   resolved:=((e->>'date')||'T'||(p->>edge)||offset_text)::timestamptz;
   if resolved at time zone zone <> local_stamp then raise sqlstate '22023' using message='Offset does not match timezone'; end if;
  else
   select array_agg(candidate order by candidate) into choices from (
    select distinct (local_stamp - ((probe at time zone zone)-(probe at time zone 'UTC'))) at time zone 'UTC' candidate
    from generate_series((local_stamp at time zone 'UTC')-interval '48 hours',(local_stamp at time zone 'UTC')+interval '48 hours',interval '6 hours') probe
   ) options where candidate at time zone zone=local_stamp;
   if coalesce(cardinality(choices),0)<>1 then raise sqlstate '22023' using message='Missing or repeated clock time requires correction or explicit offset'; end if;
   resolved:=choices[1];
  end if;
  offset_seconds:=extract(epoch from ((resolved at time zone zone)-(resolved at time zone 'UTC')))::integer;
  offset_text:=(case when offset_seconds<0 then '-' else '+' end)||lpad((abs(offset_seconds)/3600)::text,2,'0')||':'||lpad(((abs(offset_seconds)%3600)/60)::text,2,'0')||(case when abs(offset_seconds)%60<>0 then ':'||lpad((abs(offset_seconds)%60)::text,2,'0') else '' end);
  result:=result||jsonb_build_object(edge,p->edge,edge||'_offset',offset_text,case when edge='start' then 'starts_at' else 'ends_at' end,to_char(resolved at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
 end loop;
 if (result->>'starts_at')::timestamptz >= (result->>'ends_at')::timestamptz then raise sqlstate '22023' using message='End time must follow start time'; end if;
 return result;
exception when invalid_datetime_format or datetime_field_overflow then raise sqlstate '22023' using message='Invalid event date or clock time';
end $$;

create or replace function eventops_private.normalize_plan(p jsonb, prior jsonb, setup jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare result jsonb; names text[]:=array['rooms','sessions','volunteers','availability','assignments','dependencies']; limits integer[]:=array[20,100,100,1000,500,100]; name text; r jsonb; rows jsonb; ids jsonb:='{}'; prior_ids text[]; record_id text; ref text; target text; linked jsonb; index integer; allowed text[];
begin
 if p is null or jsonb_typeof(p)<>'object' or (p ? 'schema_version' and p->'schema_version'<>'1'::jsonb) or pg_column_size(p)>4194304 or exists(select 1 from jsonb_object_keys(p) k where k<>all(array['schema_version','event','rooms','sessions','volunteers','availability','assignments','dependencies','provenance'])) then raise sqlstate '22023' using message='Invalid plan fields or size'; end if;
 result:=jsonb_build_object('schema_version',1,'event',setup||eventops_private.resolve_interval(setup,setup),'provenance','[]'::jsonb);
 for index in 1..6 loop
  name:=names[index];
  if jsonb_typeof(p->name) is distinct from 'array' or jsonb_array_length(p->name)>limits[index] then raise sqlstate '22023' using message='Invalid record collection or limit'; end if;
  select array_agg(value->>'id') into prior_ids from jsonb_array_elements(coalesce(prior->name,'[]'));
  rows:='[]';
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
   rows:=rows||jsonb_build_array(r||jsonb_build_object('id',record_id));
  end loop;
  result:=result||jsonb_build_object(name,rows);
 end loop;
 foreach name in array names loop
  rows:='[]';
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
   rows:=rows||jsonb_build_array(r);
  end loop;
  result:=jsonb_set(result,array[name],rows);
 end loop;
 if eventops_private.plan_shape_valid(result) is distinct from true then raise sqlstate '22023' using message='Plan fields or limits do not match the schema'; end if;
 return result;
end $$;

create or replace function eventops_private.validate_plan(p jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare issues jsonb:='[]'; collection text; r jsonb; s jsonb; a jsonb; b jsonb; room jsonb; v jsonb; report jsonb; checked jsonb; assigned_count integer; begins timestamptz; finishes timestamptz; ids text[]; seen text[]:='{}'; aliases text[];
begin
 if eventops_private.plan_shape_valid(p) is distinct from true then
  if exists(select 1 from (values('rooms',20),('sessions',100),('volunteers',100),('availability',1000),('assignments',500),('dependencies',100)) limits(k,n) where jsonb_typeof(p->k)='array' and jsonb_array_length(p->k)>n) then return jsonb_build_array(eventops_private.issue('LIMITS','{}','Record limit exceeded')); end if;
  return jsonb_build_array(eventops_private.issue('SHAPE','{}','Check plan fields'));
 end if;
 begins:=(p#>>'{event,starts_at}')::timestamptz; finishes:=(p#>>'{event,ends_at}')::timestamptz;
 begin
  checked:=eventops_private.resolve_interval(p->'event',p->'event');
  if (select count(*) from jsonb_array_elements_text(p#>'{event,locations}'))<>(select count(distinct lower(value)) from jsonb_array_elements_text(p#>'{event,locations}')) or checked->>'starts_at'<>p#>>'{event,starts_at}' or checked->>'ends_at'<>p#>>'{event,ends_at}' or begins>=finishes or p#>>'{event,start}'>=p#>>'{event,end}' then raise exception 'Invalid interval'; end if;
 exception when others then issues:=issues||eventops_private.issue('TIME','{}','Event times do not match date, zone or offsets'); end;
 foreach collection in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  aliases:='{}';
  for r in select value from jsonb_array_elements(p->collection) loop
   if r->>'id'=any(seen) or r->>'external_id'=any(aliases) then issues:=issues||eventops_private.issue('REFERENCES',array[r->>'id'],'Duplicate record identifier'); end if;
   seen:=array_append(seen,r->>'id');aliases:=array_append(aliases,r->>'external_id');
  end loop;
 end loop;
 if jsonb_array_length(p->'rooms')=0 or jsonb_array_length(p->'sessions')=0 then issues:=issues||eventops_private.issue('REFERENCES','{}','A starting plan needs rooms and sessions'); end if;
 foreach collection in array array['sessions','availability','assignments'] loop
  for r in select value from jsonb_array_elements(p->collection) loop
   begin
    checked:=eventops_private.resolve_interval_in_known_zone(r,p->'event');
    if checked->>'starts_at'<>r->>'starts_at' or checked->>'ends_at'<>r->>'ends_at' or (r->>'starts_at')::timestamptz<begins or (r->>'ends_at')::timestamptz>finishes then raise exception 'Invalid interval'; end if;
   exception when others then issues:=issues||eventops_private.issue('TIME',array[r->>'id'],'Interval must match the event date, zone and operating hours'); end;
  end loop;
 end loop;
 for s in select value from jsonb_array_elements(p->'sessions') loop
  select value into room from jsonb_array_elements(p->'rooms') where value->>'id'=s->>'room_id';
  if room is null then issues:=issues||eventops_private.issue('REFERENCES',array[s->>'id'],'Room does not exist');continue;end if;
  if (s->>'starts_at')::timestamptz-(s->>'setup_minutes')::integer*interval '1 minute'<begins or (s->>'ends_at')::timestamptz+(s->>'teardown_minutes')::integer*interval '1 minute'>finishes then issues:=issues||eventops_private.issue('TIME',array[s->>'id'],'Room buffers exceed operating hours');end if;
  if jsonb_typeof(s->'expected_attendance')<>'null' and (jsonb_typeof(room->'capacity')='null' or (room->>'capacity')::integer<(s->>'expected_attendance')::integer) then issues:=issues||eventops_private.issue('CAPACITY',array[s->>'id',room->>'id'],'Confirmed room capacity must meet attendance');end if;
  if not ((room->'feature_tags') @> (s->'required_feature_tags')) then issues:=issues||eventops_private.issue('FEATURES',array[s->>'id',room->>'id'],'Room is missing required equipment');end if;
  select count(distinct value->>'volunteer_id') into assigned_count from jsonb_array_elements(p->'assignments') where value->>'session_id'=s->>'id' and (value->>'starts_at')::timestamptz<=(s->>'starts_at')::timestamptz and (value->>'ends_at')::timestamptz>=(s->>'ends_at')::timestamptz and (jsonb_typeof(s->'required_role_tag')='null' or value->>'role_tag'=s->>'required_role_tag');
  if assigned_count<(s->>'required_volunteers')::integer then issues:=issues||eventops_private.issue('COVERAGE',array[s->>'id'],'Mandatory volunteer coverage is incomplete');end if;
 end loop;
 for a,b in select x.value,y.value from jsonb_array_elements(p->'sessions') with ordinality x(value,n) cross join jsonb_array_elements(p->'sessions') with ordinality y(value,n) where x.n<y.n loop
  if a->>'room_id'=b->>'room_id' and (a->>'starts_at')::timestamptz-(a->>'setup_minutes')::integer*interval '1 minute'<(b->>'ends_at')::timestamptz+(b->>'teardown_minutes')::integer*interval '1 minute' and (b->>'starts_at')::timestamptz-(b->>'setup_minutes')::integer*interval '1 minute'<(a->>'ends_at')::timestamptz+(a->>'teardown_minutes')::integer*interval '1 minute' then
   issues:=issues|| (eventops_private.issue('ROOM_OVERLAP',array[a->>'id',b->>'id'],'Room occupancy overlaps, including buffers') || jsonb_build_object('interval',jsonb_build_object('start',greatest((a->>'starts_at')::timestamptz-(a->>'setup_minutes')::integer*interval '1 minute',(b->>'starts_at')::timestamptz-(b->>'setup_minutes')::integer*interval '1 minute'),'end',least((a->>'ends_at')::timestamptz+(a->>'teardown_minutes')::integer*interval '1 minute',(b->>'ends_at')::timestamptz+(b->>'teardown_minutes')::integer*interval '1 minute'))));
  end if;
 end loop;
 for a in select value from jsonb_array_elements(p->'assignments') loop
  select value into v from jsonb_array_elements(p->'volunteers') where value->>'id'=a->>'volunteer_id';
  select value into s from jsonb_array_elements(p->'sessions') where value->>'id'=a->>'session_id';
  if v is null or s is null then issues:=issues||eventops_private.issue('REFERENCES',array[a->>'id'],'Assignment reference does not exist');continue;end if;
  if (select count(*) from jsonb_array_elements(p->'assignments') x where x->>'volunteer_id'=a->>'volunteer_id' and x->>'session_id'=a->>'session_id' and x->>'role_tag'=a->>'role_tag' and x->>'id'<a->>'id')>0 then issues:=issues||eventops_private.issue('REFERENCES',array[a->>'id'],'Duplicate volunteer session role assignment');end if;
  if not (v->>'active')::boolean or (not(v->'role_tags' ? (a->>'role_tag')) and a->>'role_tag'<>'general') or (jsonb_typeof(s->'required_role_tag')<>'null' and (a->>'role_tag'<>s->>'required_role_tag' or not(v->'role_tags' ? (s->>'required_role_tag')))) then issues:=issues||eventops_private.issue('ROLE',array[a->>'id'],'Volunteer must be active and qualified for the assigned role');end if;
  if not exists(select 1 from jsonb_array_elements(p->'availability') x where x->>'volunteer_id'=v->>'id' and x->>'status'='available' and (x->>'starts_at')::timestamptz<=(a->>'starts_at')::timestamptz and (x->>'ends_at')::timestamptz>=(a->>'ends_at')::timestamptz) or exists(select 1 from jsonb_array_elements(p->'availability') x where x->>'volunteer_id'=v->>'id' and x->>'status'='unavailable' and (x->>'starts_at')::timestamptz<(a->>'ends_at')::timestamptz and (a->>'starts_at')::timestamptz<(x->>'ends_at')::timestamptz) then issues:=issues||eventops_private.issue('AVAILABILITY',array[a->>'id'],'Assignment needs confirmed availability with no unavailability');end if;
 end loop;
 for a in select value from jsonb_array_elements(p->'availability') loop
  if not exists(select 1 from jsonb_array_elements(p->'volunteers') x where x->>'id'=a->>'volunteer_id') then issues:=issues||eventops_private.issue('REFERENCES',array[a->>'id'],'Availability volunteer does not exist');end if;
 end loop;
 for a,b in select x.value,y.value from jsonb_array_elements(p->'assignments') with ordinality x(value,n) cross join jsonb_array_elements(p->'assignments') with ordinality y(value,n) where x.n<y.n loop
  if a->>'volunteer_id'=b->>'volunteer_id' and (a->>'starts_at')::timestamptz<(b->>'ends_at')::timestamptz and (b->>'starts_at')::timestamptz<(a->>'ends_at')::timestamptz then issues:=issues||(eventops_private.issue('VOLUNTEER_OVERLAP',array[a->>'id',b->>'id'],'Volunteer assignments overlap')||jsonb_build_object('interval',jsonb_build_object('start',greatest((a->>'starts_at')::timestamptz,(b->>'starts_at')::timestamptz),'end',least((a->>'ends_at')::timestamptz,(b->>'ends_at')::timestamptz))));end if;
 end loop;
 for r in select value from jsonb_array_elements(p->'dependencies') loop
  select value into a from jsonb_array_elements(p->'sessions') where value->>'id'=r->>'predecessor_session_id';
  select value into b from jsonb_array_elements(p->'sessions') where value->>'id'=r->>'successor_session_id';
  if a is null or b is null then issues:=issues||eventops_private.issue('REFERENCES',array[r->>'id'],'Dependency session does not exist');continue;end if;
  if a->>'id'=b->>'id' or (b->>'starts_at')::timestamptz<(a->>'ends_at')::timestamptz+(r->>'minimum_gap_minutes')::integer*interval '1 minute' then issues:=issues||eventops_private.issue('DEPENDENCY',array[r->>'id'],'Dependency order or gap is not satisfied');end if;
 end loop;
 if exists(with recursive edges as(select value->>'predecessor_session_id' a,value->>'successor_session_id' b from jsonb_array_elements(p->'dependencies')), walk(a,b) as(select ed.a,ed.b from edges ed union select w.a,e.b from walk w join edges e on e.a=w.b) select 1 from walk final where final.a=final.b) then issues:=issues||eventops_private.issue('DEPENDENCY','{}','Dependency graph contains a cycle');end if;
 return issues;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return jsonb_build_array(eventops_private.issue('SHAPE','{}','Invalid field encoding'));
end $$;

