-- Preserve elapsed assignment intervals through daylight saving clock changes.
create function eventops_private.shift_analysis_interval(a jsonb,delta interval,e jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare edge text;shifted timestamptz;local_stamp timestamp;seconds integer;offset_text text;t jsonb:='{}';zone text:=e->>'timezone';
begin
 foreach edge in array array['start','end'] loop
  shifted:=(a->>(case when edge='start' then 'starts_at' else 'ends_at' end))::timestamptz+delta;
  local_stamp:=shifted at time zone zone;
  if local_stamp::date<>(e->>'date')::date then raise sqlstate '22023' using message='Assignment crosses event date';end if;
  seconds:=extract(epoch from (local_stamp-(shifted at time zone 'UTC')))::integer;
  offset_text:=(case when seconds<0 then '-' else '+' end)||lpad((abs(seconds)/3600)::text,2,'0')||':'||lpad(((abs(seconds)%3600)/60)::text,2,'0')||(case when abs(seconds)%60<>0 then ':'||lpad((abs(seconds)%60)::text,2,'0') else '' end);
  t:=t||jsonb_build_object(edge,to_char(local_stamp,'HH24:MI'),edge||'_offset',offset_text);
 end loop;
 return eventops_private.resolve_interval(t,e);
end $$;

create or replace function eventops_private.apply_analysis_intents(base jsonb,requests jsonb,seed text,confirmed_text text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb:=base;r jsonb;s jsonb;a jsonb;row jsonb;t jsonb;idx integer;delta interval;rid text;old_id text;seen text[]:='{}';key text;other jsonb;v text;normalized jsonb;
begin
 if eventops_private.analysis_requests_valid(requests) is distinct from true then raise sqlstate '22023' using message='Invalid interpreted requests';end if;
 for r in select value from jsonb_array_elements(requests) loop
  if (r#>>'{span,end}')::integer<=(r#>>'{span,start}')::integer or substring(confirmed_text from (r#>>'{span,start}')::integer+1 for (r#>>'{span,end}')::integer-(r#>>'{span,start}')::integer) is distinct from r#>>'{span,quote}' then raise sqlstate '22023' using message='Invalid confirmed text span';end if;
  key:='intent:'||(r->>'intent_id');if key=any(seen) then raise sqlstate '22023' using message='Duplicate request';end if;seen:=array_append(seen,key);
  if r ? 'session_id' then
   select value into s from jsonb_array_elements(p->'sessions') where value->>'id'=r->>'session_id';if s is null then raise sqlstate '22023' using message='Unknown session';end if;
   if exists(select 1 from jsonb_array_elements(requests) x where x->>'session_id'=r->>'session_id' and x->>'intent_id'<>r->>'intent_id' and (x->>'action'='cancel_session' or r->>'action'='cancel_session')) then raise sqlstate '22023' using message='Conflicting cancellation';end if;
  end if;
  if r ? 'room_id' and not exists(select 1 from jsonb_array_elements(p->'rooms') x where x->>'id'=r->>'room_id') then raise sqlstate '22023' using message='Unknown room';end if;
  foreach key in array array['volunteer_id','from_volunteer_id','to_volunteer_id'] loop
   if r->>key is not null and not exists(select 1 from jsonb_array_elements(p->'volunteers') x where x->>'id'=r->>key) then raise sqlstate '22023' using message='Unknown volunteer';end if;
  end loop;
  if r->>'action'='record_availability' then
   normalized:=eventops_private.resolve_interval(r->'interval',p->'event');
   if r->>'status'='available' and exists(select 1 from jsonb_array_elements(base->'availability') x where x->>'volunteer_id'=r->>'volunteer_id' and x->>'status'='unavailable' and (normalized->>'starts_at')::timestamptz<(x->>'ends_at')::timestamptz and (x->>'starts_at')::timestamptz<(normalized->>'ends_at')::timestamptz) then raise sqlstate '22023' using message='Contradictory recorded availability';end if;
   for other in select value from jsonb_array_elements(requests) where value->>'action'='record_availability' and value->>'intent_id'<>r->>'intent_id' and value->>'volunteer_id'=r->>'volunteer_id' and value->>'status'<>r->>'status' loop
    row:=eventops_private.resolve_interval(other->'interval',p->'event');
    if (normalized->>'starts_at')::timestamptz<(row->>'ends_at')::timestamptz and (row->>'starts_at')::timestamptz<(normalized->>'ends_at')::timestamptz then raise sqlstate '22023' using message='Contradictory requested availability';end if;
   end loop;
  end if;
  case r->>'action'
  when 'move_session','change_time' then
   if r->>'action'='move_session' then
    key:='room:'||(s->>'id');if key=any(seen) then raise sqlstate '22023' using message='Conflicting room requests';end if;seen:=array_append(seen,key);
    s:=jsonb_set(s,'{room_id}',r->'room_id');
   end if;
   if jsonb_array_length(r->'time_choices')>1 then raise sqlstate '22023' using message='Select one exact time choice';end if;
   t:=r#>'{time_choices,0}';
   if t is not null then
    key:='time:'||(s->>'id');if key=any(seen) then raise sqlstate '22023' using message='Conflicting time requests';end if;seen:=array_append(seen,key);
    if position(t->>'start' in r#>>'{span,quote}')=0 or position(t->>'end' in r#>>'{span,quote}')=0 then raise sqlstate '22023' using message='Time is not explicit in confirmed text';end if;
    normalized:=eventops_private.resolve_interval(t,p->'event');delta:=(normalized->>'starts_at')::timestamptz-(s->>'starts_at')::timestamptz;
    s:=s||t||normalized;
    for a,idx in select value,(ordinality-1)::integer from jsonb_array_elements(p->'assignments') with ordinality loop
     if a->>'session_id'=s->>'id' then
      if (((a->>'starts_at')::timestamptz+delta) at time zone (p#>>'{event,timezone}'))::date<>(p#>>'{event,date}')::date or (((a->>'ends_at')::timestamptz+delta) at time zone (p#>>'{event,timezone}'))::date<>(p#>>'{event,date}')::date then raise sqlstate '22023' using message='Assignment crosses event date';end if;
      t:=eventops_private.shift_analysis_interval(a,delta,p->'event');
      p:=jsonb_set(p,array['assignments',idx::text],a||t||eventops_private.resolve_interval(t,p->'event'));
     end if;
    end loop;
   end if;
   select (ordinality-1)::integer into idx from jsonb_array_elements(p->'sessions') with ordinality where value->>'id'=s->>'id';p:=jsonb_set(p,array['sessions',idx::text],s);
  when 'cancel_session' then
   p:=jsonb_set(p,'{sessions}',coalesce((select jsonb_agg(x) from jsonb_array_elements(p->'sessions') x where x->>'id'<>r->>'session_id'),'[]'));
   p:=jsonb_set(p,'{assignments}',coalesce((select jsonb_agg(x) from jsonb_array_elements(p->'assignments') x where x->>'session_id'<>r->>'session_id'),'[]'));
   p:=jsonb_set(p,'{dependencies}',coalesce((select jsonb_agg(x) from jsonb_array_elements(p->'dependencies') x where x->>'predecessor_session_id'<>r->>'session_id' and x->>'successor_session_id'<>r->>'session_id'),'[]'));
  when 'change_assignment' then
   select value into a from jsonb_array_elements(p->'assignments') where value->>'session_id'=r->>'session_id' and value->>'volunteer_id'=r->>'from_volunteer_id' and value->>'role_tag'=r->>'role_tag';
   if r->>'from_volunteer_id' is not null and a is null then raise sqlstate '22023' using message='Unknown assignment';end if;
   if (r->>'find_replacement')::boolean and r->>'to_volunteer_id' is null then raise sqlstate '22023' using message='Replacement unresolved';end if;
   p:=jsonb_set(p,'{assignments}',coalesce((select jsonb_agg(x) from jsonb_array_elements(p->'assignments') x where a is null or x->>'id'<>a->>'id'),'[]'));
   if r->>'to_volunteer_id' is not null then
    row:=jsonb_build_object('id',coalesce(a->>'id',eventops_private.analysis_id(seed,r->>'intent_id','assignment')),'external_id',coalesce(a->>'external_id','analysis-'||(r->>'intent_id')),'volunteer_id',r->>'to_volunteer_id','session_id',r->>'session_id','role_tag',r->>'role_tag')||jsonb_build_object('start',s->'start','end',s->'end','start_offset',s->'start_offset','end_offset',s->'end_offset','starts_at',s->'starts_at','ends_at',s->'ends_at');
    p:=jsonb_set(p,'{assignments}',(p->'assignments')||jsonb_build_array(row));
   end if;
  when 'record_availability' then
   t:=r->'interval';if position(t->>'start' in r#>>'{span,quote}')=0 or position(t->>'end' in r#>>'{span,quote}')=0 then raise sqlstate '22023' using message='Interval is not explicit';end if;
   row:=jsonb_build_object('id',eventops_private.analysis_id(seed,r->>'intent_id','availability'),'external_id','analysis-'||(r->>'intent_id'),'volunteer_id',r->>'volunteer_id','status',r->>'status')||t||eventops_private.resolve_interval(t,p->'event');
   p:=jsonb_set(p,'{availability}',(p->'availability')||jsonb_build_array(row));
  when 'change_room_facts' then
   key:='facts:'||(r->>'room_id');if key=any(seen) then raise sqlstate '22023' using message='Conflicting room facts';end if;seen:=array_append(seen,key);
   select value,(ordinality-1)::integer into row,idx from jsonb_array_elements(p->'rooms') with ordinality where value->>'id'=r->>'room_id';p:=jsonb_set(p,array['rooms',idx::text],row||jsonb_build_object('capacity',r->'capacity','feature_tags',r->'feature_tags'));
  else raise sqlstate '22023' using message='Unsupported action';end case;
 end loop;
 if eventops_private.plan_shape_valid(p) is distinct from true then raise sqlstate '22023' using message='Invalid candidate';end if;
 return p;
end $$;

revoke all on all functions in schema eventops_private from public,anon,authenticated,eventops_worker;
