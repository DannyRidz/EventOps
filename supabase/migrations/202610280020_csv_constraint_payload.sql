-- Keep complete schema checks while excluding evidence bulk from constraint scans.
create or replace function eventops_private.validate_plan(p jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare issues jsonb:='[]'; collection text; r jsonb; s jsonb; a jsonb; b jsonb; room jsonb; v jsonb; report jsonb; checked jsonb; assigned_count integer; begins timestamptz; finishes timestamptz; ids text[]; seen text[]:='{}'; aliases text[];
begin
 if eventops_private.plan_shape_valid(p) is distinct from true then
  if exists(select 1 from (values('rooms',20),('sessions',100),('volunteers',100),('availability',1000),('assignments',500),('dependencies',100)) limits(k,n) where jsonb_typeof(p->k)='array' and jsonb_array_length(p->k)>n) then return jsonb_build_array(eventops_private.issue('LIMITS','{}','Record limit exceeded')); end if;
  return jsonb_build_array(eventops_private.issue('SHAPE','{}','Check plan fields'));
 end if;
 -- Evidence shape has been checked above; constraint rules do not read provenance.
 -- Avoid repeatedly detoasting the much larger evidence array in record scans.
 p:=jsonb_set(p,'{provenance}','[]'::jsonb);
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

