-- T3 owns operational plans. The T2 setup snapshot remains separate.
create schema eventops_private;
revoke all on schema eventops_private from public,anon,authenticated;
create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists pgcrypto with schema extensions;
alter table public.workspaces add column deletion_requested_at timestamptz;
alter table public.workspaces add column retention_policy_version text not null default '2026-10-27';
alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check check(status in ('draft','active','archived','trashed'));
alter table public.events add column current_revision_id uuid;
alter table public.plan_drafts add column plan_snapshot jsonb;
alter table public.plan_drafts add column candidate_digest text;
alter table public.plan_drafts add column validation_report jsonb;
alter table public.plan_drafts add column base_revision_id uuid;
alter table public.plan_drafts add column id uuid not null default gen_random_uuid() unique;
alter table public.plan_drafts add column created_at timestamptz;
update public.plan_drafts d set created_at=e.created_at from public.events e where e.id=d.event_id;
alter table public.plan_drafts alter column created_at set not null;
alter table public.plan_drafts alter column created_at set default now();
alter table public.profiles add column created_at timestamptz;
update public.profiles set created_at=adult_attested_at;
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column created_at set default now();
alter table public.memberships add column created_at timestamptz;
update public.memberships m set created_at=w.created_at from public.workspaces w where w.id=m.workspace_id;
alter table public.memberships alter column created_at set not null;
alter table public.memberships alter column created_at set default now();

-- PLAN_SCHEMA_START
create function eventops_private.plan_shape_valid(p jsonb) returns boolean language sql immutable set search_path='' as $body$
 select extensions.jsonb_matches_schema($schema${"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"schema_version":{"type":"number","const":1},"event":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":120,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"date":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"},"timezone":{"type":"string","minLength":1,"maxLength":100},"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"locations":{"minItems":1,"maxItems":20,"type":"array","items":{"type":"string","minLength":1,"maxLength":120,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"}},"start_offset":{"type":"string"},"end_offset":{"type":"string"},"starts_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"ends_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"}},"required":["name","date","timezone","start","end","locations","start_offset","end_offset","starts_at","ends_at"],"additionalProperties":false},"rooms":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"name":{"type":"string","minLength":1,"maxLength":160,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"location":{"type":"string","minLength":1,"maxLength":240,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"capacity":{"anyOf":[{"type":"integer","exclusiveMinimum":0,"maximum":1000000},{"type":"null"}]},"feature_tags":{"maxItems":20,"type":"array","items":{"type":"string","minLength":1,"maxLength":64,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"}}},"required":["id","external_id","name","location","capacity","feature_tags"],"additionalProperties":false}},"sessions":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"title":{"type":"string","minLength":1,"maxLength":160,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"starts_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"ends_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"start_offset":{"type":"string"},"end_offset":{"type":"string"},"room_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"required_volunteers":{"type":"integer","minimum":0,"maximum":100},"expected_attendance":{"anyOf":[{"type":"integer","minimum":0,"maximum":1000000},{"type":"null"}]},"required_role_tag":{"anyOf":[{"type":"string","minLength":1,"maxLength":64,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},{"type":"null"}]},"required_feature_tags":{"maxItems":20,"type":"array","items":{"type":"string","minLength":1,"maxLength":64,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"}},"setup_minutes":{"type":"integer","minimum":0,"maximum":1440},"teardown_minutes":{"type":"integer","minimum":0,"maximum":1440}},"required":["id","external_id","title","start","end","starts_at","ends_at","start_offset","end_offset","room_id","required_volunteers","expected_attendance","required_role_tag","required_feature_tags","setup_minutes","teardown_minutes"],"additionalProperties":false}},"volunteers":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"display_name":{"type":"string","minLength":1,"maxLength":160,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"role_tags":{"maxItems":20,"type":"array","items":{"type":"string","minLength":1,"maxLength":64,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"}},"active":{"type":"boolean"}},"required":["id","external_id","display_name","role_tags","active"],"additionalProperties":false}},"availability":{"maxItems":1000,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"volunteer_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"starts_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"ends_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"start_offset":{"type":"string"},"end_offset":{"type":"string"},"status":{"type":"string","enum":["available","unavailable"]}},"required":["id","external_id","volunteer_id","start","end","starts_at","ends_at","start_offset","end_offset","status"],"additionalProperties":false}},"assignments":{"maxItems":500,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"volunteer_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"role_tag":{"type":"string","minLength":1,"maxLength":64,"pattern":"^\\S(?:[\\s\\S]*\\S)?$"},"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"starts_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"ends_at":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"start_offset":{"type":"string"},"end_offset":{"type":"string"}},"required":["id","external_id","volunteer_id","session_id","role_tag","start","end","starts_at","ends_at","start_offset","end_offset"],"additionalProperties":false}},"dependencies":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"external_id":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[\\x21-\\x7e]+$"},"predecessor_session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"successor_session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"minimum_gap_minutes":{"type":"integer","minimum":0,"maximum":1440}},"required":["id","external_id","predecessor_session_id","successor_session_id","minimum_gap_minutes"],"additionalProperties":false}},"provenance":{"maxItems":25000,"type":"array","items":{"type":"object","properties":{"record_id":{"type":"string"},"field_path":{"type":"string"},"source_record_ids":{"minItems":1,"type":"array","items":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"derivation_kind":{"type":"string","enum":["manual","inherited"]}},"required":["record_id","field_path","source_record_ids","derivation_kind"],"additionalProperties":false}}},"required":["schema_version","event","rooms","sessions","volunteers","availability","assignments","dependencies","provenance"],"additionalProperties":false}$schema$::json,p);
$body$;
-- PLAN_SCHEMA_END

create function eventops_private.hash(p jsonb) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(p::text,'UTF8'),'sha256'),'hex');
$$;
create function eventops_private.issue(rule text, ids text[], message text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('rule',rule,'record_ids',coalesce((select jsonb_agg(v order by v) from unnest(ids) v),'[]'::jsonb),'message',message);
$$;

create function eventops_private.resolve_interval(p jsonb, e jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare edge text; local_stamp timestamp; resolved timestamptz; choices timestamptz[]; result jsonb:='{}'; offset_text text; offset_seconds integer; zone text:=e->>'timezone';
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(e->'date') is distinct from 'string' or jsonb_typeof(e->'timezone') is distinct from 'string' or not exists(select 1 from pg_timezone_names where name=zone) then raise sqlstate '22023' using message='Invalid interval timezone'; end if;
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

create function eventops_private.normalize_plan(p jsonb, prior jsonb, setup jsonb) returns jsonb
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
   if name in ('sessions','availability','assignments') then r:=r||eventops_private.resolve_interval(r,setup); end if;
   rows:=rows||jsonb_build_array(r);
  end loop;
  result:=jsonb_set(result,array[name],rows);
 end loop;
 if eventops_private.plan_shape_valid(result) is distinct from true then raise sqlstate '22023' using message='Plan fields or limits do not match the schema'; end if;
 return result;
end $$;

create function eventops_private.validate_plan(p jsonb) returns jsonb
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
    checked:=eventops_private.resolve_interval(r,p->'event');
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

create table public.source_artifacts (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,
 kind text not null check(kind='manual'),sha256 text not null,captured_by uuid not null references public.profiles(user_id),captured_at timestamptz not null default now(),created_at timestamptz not null default now(),metadata jsonb not null,
 unique(workspace_id,event_id,id),foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
create table public.source_records (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,artifact_id uuid not null,
 record_id text not null,field_path text not null,locator text not null,value_json jsonb not null,sha256 text not null,created_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),foreign key(workspace_id,event_id,artifact_id) references public.source_artifacts(workspace_id,event_id,id)
);
create table public.revisions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,revision_number integer not null check(revision_number between 1 and 500),snapshot jsonb not null,schema_version integer not null default 1 check(schema_version=1),sha256 text not null,approved_by uuid not null references public.profiles(user_id),approved_at timestamptz not null default now(),reason text not null,parent_revision_id uuid,proposal_id uuid,created_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),unique(event_id,revision_number),unique(proposal_id),foreign key(workspace_id,event_id) references public.events(workspace_id,id),foreign key(workspace_id,event_id,parent_revision_id) references public.revisions(workspace_id,event_id,id),check((revision_number=1)=(parent_revision_id is null)),check(eventops_private.plan_shape_valid(snapshot))
);
alter table public.events add foreign key(workspace_id,id,current_revision_id) references public.revisions(workspace_id,event_id,id);
alter table public.plan_drafts add foreign key(workspace_id,event_id,base_revision_id) references public.revisions(workspace_id,event_id,id);
create table public.updates (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,input_kind text not null check(input_kind='manual_edit'),raw_text text not null,confirmed_text text not null,state text not null check(state='text_confirmed'),generation integer not null default 1,captured_at timestamptz not null default now(),confirmed_at timestamptz not null default now(),confirmed_by uuid not null references public.profiles(user_id),created_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
create table public.proposals (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,update_id uuid not null,base_revision_id uuid not null,generation integer not null default 1 check(generation=1),state text not null check(state in ('ready','infeasible','approved','rejected')),candidate_snapshot jsonb not null,canonical_patch jsonb not null,candidate_digest text not null,patch_digest text not null,constraint_report jsonb not null,request_coverage jsonb not null,validator_version text not null check(validator_version='plan-v1'),create_key uuid not null,request_digest text not null,created_at timestamptz not null default now(),
 unique(workspace_id,event_id,id),unique(event_id,create_key),foreign key(workspace_id,event_id,update_id) references public.updates(workspace_id,event_id,id),foreign key(workspace_id,event_id,base_revision_id) references public.revisions(workspace_id,event_id,id),foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
alter table public.revisions add foreign key(workspace_id,event_id,proposal_id) references public.proposals(workspace_id,event_id,id);
create table public.approval_receipts (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,actor uuid not null references public.profiles(user_id),operation text not null check(operation in ('confirm','approve')),idempotency_key uuid not null,request_digest text not null,revision_id uuid not null,candidate_digest text not null,created_at timestamptz not null default now(),
 unique(event_id,actor,operation,idempotency_key),foreign key(workspace_id,event_id,revision_id) references public.revisions(workspace_id,event_id,id),foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,action text not null,actor uuid not null references public.profiles(user_id),revision_id uuid,proposal_id uuid,safe_metadata jsonb not null default '{}',created_at timestamptz not null default now(),
 foreign key(workspace_id,event_id) references public.events(workspace_id,id),foreign key(workspace_id,event_id,revision_id) references public.revisions(workspace_id,event_id,id),foreign key(workspace_id,event_id,proposal_id) references public.proposals(workspace_id,event_id,id)
);
-- Immutable records also resist accidental privileged UPDATE. Retention purging is a later, separate operation.
create function eventops_private.immutable_record() returns trigger language plpgsql set search_path='' as $$ begin raise sqlstate '42501' using message='Record is immutable';end $$;
create function eventops_private.immutable_proposal() returns trigger language plpgsql set search_path='' as $$ begin if (to_jsonb(new)-'state')<>(to_jsonb(old)-'state') then raise sqlstate '42501' using message='Proposal generation is immutable';end if;return new;end $$;
create trigger immutable_proposal before update on public.proposals for each row execute function eventops_private.immutable_proposal();
do $$ declare t text;begin foreach t in array array['source_artifacts','source_records','revisions','updates','approval_receipts','audit_events'] loop execute format('create trigger immutable_record before update on public.%I for each row execute function eventops_private.immutable_record()',t);end loop;end $$;
do $$ declare t text;begin foreach t in array array['source_artifacts','source_records','revisions','updates','proposals','approval_receipts','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_records on public.%I for select to authenticated using(workspace_id in(select id from public.workspaces where owner_user_id=(select auth.uid()) and deletion_requested_at is null) and event_id in(select id from public.events where status<>''trashed''))',t);
end loop;end $$;

create function eventops_private.plan_facts(p jsonb) returns table(record_id text,field_path text,value_json jsonb)
language plpgsql immutable set search_path='' as $$
declare c text;r jsonb;f record;
begin
 for f in select key,value from jsonb_each(coalesce(p->'event','{}')) loop record_id:='event';field_path:=f.key;value_json:=f.value;return next;end loop;
 foreach c in array array['rooms','sessions','volunteers','availability','assignments','dependencies'] loop
  for r in select value from jsonb_array_elements(coalesce(p->c,'[]')) loop
   for f in select key,value from jsonb_each(r) where key<>'id' loop record_id:=r->>'id';field_path:=f.key;value_json:=f.value;return next;end loop;
  end loop;
 end loop;
end $$;
create function eventops_private.change_facts(prior jsonb,p jsonb) returns table(record_id text,field_path text,value_json jsonb)
language sql immutable set search_path='' as $$
 select n.record_id,n.field_path,n.value_json from eventops_private.plan_facts(p) n left join eventops_private.plan_facts(prior) o using(record_id,field_path) where o.value_json is distinct from n.value_json
 union all
 select distinct o.record_id,'$record','null'::jsonb from eventops_private.plan_facts(prior) o where o.record_id<>'event' and not exists(select 1 from eventops_private.plan_facts(p) n where n.record_id=o.record_id);
$$;
create function eventops_private.capture_plan(p jsonb,prior jsonb,w uuid,e uuid,actor uuid,kind text) returns jsonb
language plpgsql volatile set search_path='' as $$
declare artifact uuid;source uuid;f record;entry jsonb;provenance jsonb:='[]';changes jsonb;result jsonb;old_facts jsonb;old_evidence jsonb;fact_key text;
begin
 select coalesce(jsonb_object_agg(record_id||':'||field_path,value_json),'{}') into old_facts from eventops_private.plan_facts(prior);
 select coalesce(jsonb_object_agg(value->>'record_id'||':'||(value->>'field_path'),value),'{}') into old_evidence from jsonb_array_elements(coalesce(prior->'provenance','[]'));
 insert into public.source_artifacts(workspace_id,event_id,kind,sha256,captured_by,metadata) values(w,e,'manual',eventops_private.hash(p),actor,jsonb_build_object('operation',kind,'normalization','plan-v1')) returning id into artifact;
 for f in select * from eventops_private.plan_facts(p) loop
  entry:=null;
  fact_key:=f.record_id||':'||f.field_path;
  if old_facts ? fact_key and old_facts->fact_key=f.value_json then
   entry:=(old_evidence->fact_key)||jsonb_build_object('derivation_kind','inherited');
  end if;
  if entry is null then
   insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(w,e,artifact,f.record_id,f.field_path,'manual/'||f.record_id||'/'||f.field_path,f.value_json,eventops_private.hash(f.value_json)) returning id into source;
   entry:=jsonb_build_object('record_id',f.record_id,'field_path',f.field_path,'source_record_ids',jsonb_build_array(source),'derivation_kind','manual');
  end if;
  provenance:=provenance||jsonb_build_array(entry);
 end loop;
 for f in select * from eventops_private.change_facts(prior,p) where field_path='$record' loop
  insert into public.source_records(workspace_id,event_id,artifact_id,record_id,field_path,locator,value_json,sha256) values(w,e,artifact,f.record_id,f.field_path,'manual/'||f.record_id||'/$record','null',eventops_private.hash('null')) returning id into source;
  if kind<>'stage' then provenance:=provenance||jsonb_build_array(jsonb_build_object('record_id',f.record_id,'field_path','$record','source_record_ids',jsonb_build_array(source),'derivation_kind','manual'));end if;
 end loop;
 return jsonb_set(p,'{provenance}',provenance);
end $$;
create function eventops_private.evidence_valid(p jsonb,prior jsonb,w uuid,e uuid) returns boolean
language sql stable set search_path='' as $$
 with facts as materialized(select * from eventops_private.plan_facts(p) union all select * from eventops_private.change_facts(prior,p) where field_path='$record'), evidence as materialized(select value v from jsonb_array_elements(p->'provenance'))
 select (select count(*) from facts)=(select count(*) from evidence) and not exists(
 select 1 from facts f left join evidence x on x.v->>'record_id'=f.record_id and x.v->>'field_path'=f.field_path
 where x.v is null or jsonb_array_length(x.v->'source_record_ids')=0 or exists(
 select 1 from jsonb_array_elements_text(x.v->'source_record_ids') ref left join public.source_records s on s.id=ref::uuid and s.workspace_id=w and s.event_id=e
 where s.id is null or s.record_id<>f.record_id or s.field_path<>f.field_path or s.value_json<>f.value_json or s.sha256<>eventops_private.hash(s.value_json)))

$$;
create function eventops_private.request_coverage(prior jsonb,p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('record_id',record_id,'field_path',field_path,'state','satisfied','value_digest',eventops_private.hash(value_json)) order by record_id,field_path),'[]'::jsonb) from eventops_private.change_facts(prior,p);
$$;

create function eventops_private.apply_patch(base jsonb,patch jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=base;op jsonb;paths text[]:='{}';path text;
begin
 if patch is null or jsonb_typeof(patch)<>'array' or jsonb_array_length(patch) not between 1 and 7 then raise sqlstate '22023' using message='Invalid patch';end if;
 for op in select value from jsonb_array_elements(patch) loop
  path:=op->>'path';
  if jsonb_typeof(op)<>'object' or (select count(*) from jsonb_object_keys(op))<>3 or op->>'op' is distinct from 'replace' or not(op ? 'value') or path is null or path<>all(array['/event','/rooms','/sessions','/volunteers','/availability','/assignments','/dependencies']) or path=any(paths) then raise sqlstate '22023' using message='Unsupported or duplicate patch path';end if;
  paths:=array_append(paths,path);result:=jsonb_set(result,array[substr(path,2)],op->'value');
 end loop;
 return result;
end $$;
create function eventops_private.lock_event(e uuid) returns public.events
language plpgsql volatile security definer set search_path='' as $$
declare ev public.events;w public.workspaces;actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required';end if;
 select ws.* into w from public.workspaces ws join public.memberships m on m.workspace_id=ws.id and m.user_id=actor and m.role='owner' where ws.owner_user_id=actor for update of ws;
 if w.id is null or w.deletion_requested_at is not null then raise sqlstate 'P0002' using message='Event not found';end if;
 select * into ev from public.events where id=e and workspace_id=w.id for update;
 if ev.id is null or ev.status in ('trashed','archived') then raise sqlstate 'P0002' using message='Event not found';end if;
 return ev;
end $$;

create function public.stage_plan(p_event_id uuid,p_plan jsonb,p_expected_generation integer,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.plan_drafts;candidate jsonb;report jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.status<>'draft' or ev.current_revision_id is not null then raise sqlstate 'P0001' using message='Use a proposal for approved plans';end if;
 if p_confirmed is distinct from true then raise sqlstate '22023' using message='Confirm manual assertions';end if;
 select * into draft from public.plan_drafts where event_id=ev.id and workspace_id=ev.workspace_id for update;
 if p_expected_generation is distinct from draft.generation then raise sqlstate 'P0001' using message='Draft changed';end if;
 candidate:=eventops_private.normalize_plan(p_plan,draft.plan_snapshot,draft.snapshot);
 candidate:=eventops_private.capture_plan(candidate,draft.plan_snapshot,ev.workspace_id,ev.id,auth.uid(),'stage');
 report:=eventops_private.validate_plan(candidate);
 update public.plan_drafts set plan_snapshot=candidate,candidate_digest=eventops_private.hash(candidate),validation_report=report,generation=generation+1,saved_at=clock_timestamp() where event_id=ev.id;
 return jsonb_build_object('generation',draft.generation+1,'snapshot',candidate,'candidate_digest',eventops_private.hash(candidate),'validation_report',report,'validator_version','plan-v1');
end $$;

create function public.confirm_plan(p_event_id uuid,p_expected_generation integer,p_candidate_digest text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;draft public.plan_drafts;receipt public.approval_receipts;revision uuid;digest text;report jsonb;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_idempotency_key is null or p_expected_generation is null or p_candidate_digest is null then raise sqlstate '22023' using message='Missing confirmation inputs';end if;
 digest:=eventops_private.hash(jsonb_build_object('event',p_event_id,'generation',p_expected_generation,'candidate_digest',p_candidate_digest));
 select * into receipt from public.approval_receipts where event_id=ev.id and actor=auth.uid() and operation='confirm' and idempotency_key=p_idempotency_key;
 if receipt.id is not null then if receipt.request_digest<>digest then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return to_jsonb(receipt);end if;
 if ev.status<>'draft' or ev.current_revision_id is not null then raise sqlstate 'P0001' using message='Stale plan';end if;
 select * into draft from public.plan_drafts where event_id=ev.id and workspace_id=ev.workspace_id for update;
 if p_expected_generation is distinct from draft.generation or p_candidate_digest is distinct from draft.candidate_digest or draft.plan_snapshot is null then raise sqlstate 'P0001' using message='Draft changed';end if;
 report:=eventops_private.validate_plan(draft.plan_snapshot);
 if jsonb_array_length(report)>0 or eventops_private.hash(draft.plan_snapshot)<>p_candidate_digest or not eventops_private.evidence_valid(draft.plan_snapshot,null,ev.workspace_id,ev.id) then raise sqlstate '22023' using message='Plan constraints or evidence failed';end if;
 insert into public.revisions(workspace_id,event_id,revision_number,snapshot,sha256,approved_by,reason) values(ev.workspace_id,ev.id,1,draft.plan_snapshot,p_candidate_digest,auth.uid(),'Initial plan confirmation') returning id into revision;
 update public.events set current_revision_id=revision,status='active' where id=ev.id;
 update public.plan_drafts set base_revision_id=revision where event_id=ev.id;
 insert into public.audit_events(workspace_id,event_id,action,actor,revision_id) values(ev.workspace_id,ev.id,'plan_confirmed',auth.uid(),revision);
 insert into public.approval_receipts(workspace_id,event_id,actor,operation,idempotency_key,request_digest,revision_id,candidate_digest) values(ev.workspace_id,ev.id,auth.uid(),'confirm',p_idempotency_key,digest,revision,p_candidate_digest) returning * into receipt;
 return to_jsonb(receipt);
end $$;

create function public.create_manual_proposal(p_event_id uuid,p_expected_head uuid,p_patch jsonb,p_confirmed boolean,p_reason text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;base jsonb;candidate jsonb;patch jsonb:='[]';op jsonb;report jsonb;coverage jsonb;request text;proposal public.proposals;update_id uuid;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_confirmed is distinct from true or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 or p_idempotency_key is null or p_expected_head is null then raise sqlstate '22023' using message='Explicit confirmed manual edit and reason required';end if;
 request:=eventops_private.hash(jsonb_build_object('head',p_expected_head,'patch',p_patch,'reason',p_reason));
 select * into proposal from public.proposals where event_id=ev.id and create_key=p_idempotency_key;
 if proposal.id is not null then if proposal.request_digest<>request then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return to_jsonb(proposal);end if;
 if ev.status<>'active' or ev.current_revision_id is distinct from p_expected_head then raise sqlstate 'P0001' using message='Stale plan';end if;
 select snapshot into base from public.revisions where id=ev.current_revision_id and workspace_id=ev.workspace_id and event_id=ev.id;
 candidate:=eventops_private.apply_patch(base,p_patch);
 candidate:=eventops_private.normalize_plan(candidate,base,candidate->'event');
 coverage:=eventops_private.request_coverage(base,candidate);
 if jsonb_array_length(coverage)=0 then raise sqlstate '22023' using message='No plan changes';end if;
 candidate:=eventops_private.capture_plan(candidate,base,ev.workspace_id,ev.id,auth.uid(),'manual_proposal');
 for op in select to_jsonb(k) from unnest(array['event','rooms','sessions','volunteers','availability','assignments','dependencies']) k loop if base->(op#>>'{}') is distinct from candidate->(op#>>'{}') then patch:=patch||jsonb_build_array(jsonb_build_object('op','replace','path','/'||(op#>>'{}'),'value',candidate->(op#>>'{}')));end if;end loop;
 report:=eventops_private.validate_plan(candidate);
 insert into public.updates(workspace_id,event_id,input_kind,raw_text,confirmed_text,state,confirmed_by) values(ev.workspace_id,ev.id,'manual_edit',p_reason,p_reason,'text_confirmed',auth.uid()) returning id into update_id;
 insert into public.proposals(workspace_id,event_id,update_id,base_revision_id,state,candidate_snapshot,canonical_patch,candidate_digest,patch_digest,constraint_report,request_coverage,validator_version,create_key,request_digest) values(ev.workspace_id,ev.id,update_id,p_expected_head,case when jsonb_array_length(report)=0 then 'ready' else 'infeasible' end,candidate,patch,eventops_private.hash(candidate),eventops_private.hash(patch),report,coverage,'plan-v1',p_idempotency_key,request) returning * into proposal;
 return to_jsonb(proposal);
end $$;

create function public.approve_proposal(p_event_id uuid,p_proposal_id uuid,p_base_revision_id uuid,p_generation integer,p_candidate_digest text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;proposal public.proposals;receipt public.approval_receipts;base jsonb;candidate jsonb;request text;revision uuid;number integer;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if ev.status<>'active' then raise sqlstate 'P0001' using message='Stale plan';end if;
 if p_idempotency_key is null or p_generation is null or p_candidate_digest is null or p_base_revision_id is null or p_proposal_id is null then raise sqlstate '22023' using message='Missing approval inputs';end if;
 request:=eventops_private.hash(jsonb_build_object('event',p_event_id,'proposal',p_proposal_id,'base',p_base_revision_id,'generation',p_generation,'candidate_digest',p_candidate_digest));
 select * into receipt from public.approval_receipts where event_id=ev.id and actor=auth.uid() and operation='approve' and idempotency_key=p_idempotency_key;
 if receipt.id is not null then if receipt.request_digest<>request then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return to_jsonb(receipt);end if;
 select * into proposal from public.proposals where id=p_proposal_id and workspace_id=ev.workspace_id and event_id=ev.id for update;
 if proposal.id is null then raise sqlstate 'P0002' using message='Proposal not found';end if;
 if proposal.state<>'ready' or proposal.generation is distinct from p_generation or proposal.candidate_digest is distinct from p_candidate_digest then raise sqlstate 'P0001' using message='Proposal changed';end if;
 if ev.current_revision_id is distinct from p_base_revision_id or proposal.base_revision_id is distinct from p_base_revision_id then raise sqlstate 'P0001' using message='Stale plan';end if;
 select snapshot,revision_number into base,number from public.revisions where id=ev.current_revision_id and workspace_id=ev.workspace_id and event_id=ev.id;
 if number>=500 then raise sqlstate '22023' using message='Revision limit reached';end if;
 candidate:=jsonb_set(eventops_private.apply_patch(base,proposal.canonical_patch),'{provenance}',proposal.candidate_snapshot->'provenance');
 if candidate<>proposal.candidate_snapshot or eventops_private.hash(candidate)<>p_candidate_digest or eventops_private.hash(proposal.canonical_patch)<>proposal.patch_digest or proposal.validator_version<>'plan-v1' or jsonb_array_length(eventops_private.validate_plan(candidate))>0 or not eventops_private.evidence_valid(candidate,base,ev.workspace_id,ev.id) or eventops_private.request_coverage(base,candidate)<>proposal.request_coverage then raise sqlstate '22023' using message='Plan constraints, evidence or requests failed';end if;
 insert into public.revisions(workspace_id,event_id,revision_number,snapshot,sha256,approved_by,reason,parent_revision_id,proposal_id) values(ev.workspace_id,ev.id,number+1,candidate,p_candidate_digest,auth.uid(),'Approved manual changes',ev.current_revision_id,proposal.id) returning id into revision;
 update public.events set current_revision_id=revision,name=candidate#>>'{event,name}' where id=ev.id;
 update public.proposals set state='approved' where id=proposal.id;
 insert into public.audit_events(workspace_id,event_id,action,actor,revision_id,proposal_id,safe_metadata) values(ev.workspace_id,ev.id,'proposal_approved',auth.uid(),revision,proposal.id,jsonb_build_object('revision_number',number+1));
 insert into public.approval_receipts(workspace_id,event_id,actor,operation,idempotency_key,request_digest,revision_id,candidate_digest) values(ev.workspace_id,ev.id,auth.uid(),'approve',p_idempotency_key,request,revision,p_candidate_digest) returning * into receipt;
 return to_jsonb(receipt);
end $$;

create function public.reject_proposal(p_event_id uuid,p_proposal_id uuid,p_generation integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;proposal public.proposals;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into proposal from public.proposals where id=p_proposal_id and workspace_id=ev.workspace_id and event_id=ev.id for update;
 if proposal.id is null then raise sqlstate 'P0002' using message='Proposal not found';end if;
 if p_generation is distinct from proposal.generation or proposal.state not in ('ready','infeasible','rejected') then raise sqlstate 'P0001' using message='Proposal changed';end if;
 if proposal.state<>'rejected' then update public.proposals set state='rejected' where id=proposal.id;insert into public.audit_events(workspace_id,event_id,action,actor,proposal_id) values(ev.workspace_id,ev.id,'proposal_rejected',auth.uid(),proposal.id);end if;
 return jsonb_build_object('state','rejected');
end $$;

revoke all on all functions in schema eventops_private from public,anon,authenticated;
revoke all on function public.stage_plan(uuid,jsonb,integer,boolean),public.confirm_plan(uuid,integer,text,uuid),public.create_manual_proposal(uuid,uuid,jsonb,boolean,text,uuid),public.approve_proposal(uuid,uuid,uuid,integer,text,uuid),public.reject_proposal(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.stage_plan(uuid,jsonb,integer,boolean),public.confirm_plan(uuid,integer,text,uuid),public.create_manual_proposal(uuid,uuid,jsonb,boolean,text,uuid),public.approve_proposal(uuid,uuid,uuid,integer,text,uuid),public.reject_proposal(uuid,uuid,integer) to authenticated;

create or replace function public.save_event(p_snapshot jsonb, p_request_id uuid, p_event_id uuid default null, p_expected_generation integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); workspace uuid; result uuid; existing jsonb; zone text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required'; end if;
 select id into workspace from public.workspaces where owner_user_id=actor;
 if workspace is null then raise sqlstate '42501' using message='Workspace required'; end if;
 perform 1 from public.workspaces where id=workspace and deletion_requested_at is null for update;
 if not found then raise sqlstate 'P0002' using message='Workspace not found';end if;
 if p_event_id is not null then perform 1 from public.events where id=p_event_id and workspace_id=workspace for update;end if;
 perform pg_advisory_xact_lock(hashtextextended(workspace::text,0));
 if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise sqlstate '22023' using message='Invalid event setup'; end if;
 if exists(select 1 from unnest(array['name','date','timezone','start','end','starts_at','ends_at','start_offset','end_offset']) k where jsonb_typeof(p_snapshot->k) is distinct from 'string') then raise sqlstate '22023' using message='Invalid event field'; end if;
 if (p_snapshot->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or (p_snapshot->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (p_snapshot->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise sqlstate '22023' using message='Invalid date or time'; end if;
 if jsonb_typeof(p_snapshot->'locations') is distinct from 'array' then raise sqlstate '22023' using message='Invalid locations'; end if;
 if pg_column_size(p_snapshot)>16384 or exists(select 1 from jsonb_object_keys(p_snapshot) k where k <> all(array['name','date','timezone','start','end','locations','starts_at','ends_at','start_offset','end_offset'])) then raise sqlstate '22023' using message='Invalid event fields'; end if;
 if (select count(*) from jsonb_array_elements(p_snapshot->'locations')) <> (select count(distinct lower(btrim(v #>> '{}'))) from jsonb_array_elements(p_snapshot->'locations') v) then raise sqlstate '22023' using message='Duplicate locations'; end if;
 if (p_snapshot->>'start_offset') !~ '^[+-]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' or (p_snapshot->>'end_offset') !~ '^[+-]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then raise sqlstate '22023' using message='Invalid UTC offset'; end if;
 if (p_snapshot->>'starts_at')::timestamptz <> ((p_snapshot->>'date') || 'T' || (p_snapshot->>'start') || (p_snapshot->>'start_offset'))::timestamptz or (p_snapshot->>'ends_at')::timestamptz <> ((p_snapshot->>'date') || 'T' || (p_snapshot->>'end') || (p_snapshot->>'end_offset'))::timestamptz then raise sqlstate '22023' using message='Offset does not match instant'; end if;
 zone := p_snapshot->>'timezone';
 if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or
    not (p_snapshot ?& array['name','date','timezone','start','end','locations','starts_at','ends_at']) or
    length(btrim(p_snapshot->>'name')) not between 1 and 120 or
    not exists(select 1 from pg_timezone_names where name=zone) or
    jsonb_typeof(p_snapshot->'locations') <> 'array' or jsonb_array_length(p_snapshot->'locations') not between 1 and 20 or
    (p_snapshot->>'end')::time <= (p_snapshot->>'start')::time or
    (p_snapshot->>'ends_at')::timestamptz <= (p_snapshot->>'starts_at')::timestamptz or
    ((p_snapshot->>'starts_at')::timestamptz at time zone zone) <> ((p_snapshot->>'date')::date + (p_snapshot->>'start')::time) or
    ((p_snapshot->>'ends_at')::timestamptz at time zone zone) <> ((p_snapshot->>'date')::date + (p_snapshot->>'end')::time)
 then raise sqlstate '22023' using message='Invalid event setup'; end if;
 if exists(select 1 from jsonb_array_elements(p_snapshot->'locations') value where jsonb_typeof(value) <> 'string' or length(btrim(value #>> '{}')) not between 1 and 120) then raise sqlstate '22023' using message='Invalid location'; end if;
 if p_event_id is null then
  select id into result from public.events where workspace_id=workspace and request_id=p_request_id;
  if result is not null then
   select create_snapshot into existing from public.events where id=result;
   if existing <> p_snapshot then raise sqlstate 'P0001' using message='Request already used'; end if;
   return result;
  end if;
  if (select count(*) from public.events where workspace_id=workspace) >= 10 then raise sqlstate 'P0001' using message='Event limit reached'; end if;
  insert into public.events(workspace_id,request_id,create_snapshot,name) values(workspace,p_request_id,p_snapshot,btrim(p_snapshot->>'name')) returning id into result;
  insert into public.plan_drafts(workspace_id,event_id,snapshot) values(workspace,result,p_snapshot);
 else
  select id into result from public.events where id=p_event_id and workspace_id=workspace;
  if result is null then raise sqlstate 'P0002' using message='Event not found'; end if;
  if exists(select 1 from public.events where id=result and status<>'draft') then raise sqlstate 'P0001' using message='Use a proposal for approved plans';end if;
  update public.plan_drafts set snapshot=p_snapshot,candidate_digest=null,validation_report=case when plan_snapshot is null then null else jsonb_build_array(eventops_private.issue('TIME','{}','Setup changed. Restage the saved records before confirmation')) end,generation=generation+1,saved_at=clock_timestamp() where event_id=result and workspace_id=workspace and generation=p_expected_generation;
  if not found then raise sqlstate 'P0001' using message='Draft changed'; end if;
  update public.events set name=btrim(p_snapshot->>'name') where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_event(jsonb,uuid,uuid,integer) from public,anon;
grant execute on function public.save_event(jsonb,uuid,uuid,integer) to authenticated;

-- Hide all existing setup rows consistently when their workspace or event is unavailable.
drop policy own_workspace on public.workspaces;
create policy own_workspace on public.workspaces for select to authenticated using(owner_user_id=(select auth.uid()) and deletion_requested_at is null);
drop policy own_membership on public.memberships;
create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()) and workspace_id in(select id from public.workspaces));
drop policy own_events on public.events;
create policy own_events on public.events for select to authenticated using(workspace_id in(select id from public.workspaces) and status<>'trashed');
drop policy own_drafts on public.plan_drafts;
create policy own_drafts on public.plan_drafts for select to authenticated using(workspace_id in(select id from public.workspaces) and event_id in(select id from public.events));
