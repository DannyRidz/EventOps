-- Application users can confirm and queue work, but never supply worker results.
-- Workers have no membership in authenticated and cannot execute approval.
do $$ begin if not exists(select 1 from pg_roles where rolname='eventops_worker') then create role eventops_worker nologin nosuperuser nocreatedb nocreaterole noinherit;end if;end $$;
create schema eventops_worker_api;
revoke all on schema eventops_worker_api from public,anon,authenticated;
grant usage on schema eventops_worker_api to eventops_worker;
alter table public.analysis_jobs drop constraint analysis_jobs_state_check;
alter table public.analysis_jobs drop constraint analysis_jobs_stage_check;
alter table public.analysis_jobs drop constraint analysis_jobs_error_code_check;
drop trigger immutable_job on public.analysis_jobs;
alter table public.analysis_jobs add constraint analysis_jobs_state_check check(state in ('blocked','queued','running','completed','failed','stale','cancelled'));
alter table public.analysis_jobs add column result jsonb;
alter table public.analysis_jobs add column result_digest text;
alter table public.analysis_jobs add column lease_token uuid;
alter table public.analysis_jobs add column lease_until timestamptz;
alter table public.analysis_jobs add column attempts integer not null default 0 check(attempts between 0 and 10);
alter table public.analysis_jobs add column not_before timestamptz not null default now();
alter table public.analysis_jobs add column completed_at timestamptz;
create unique index analysis_event_active on public.analysis_jobs(event_id) where state in ('queued','running');
create table public.model_runs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,event_id uuid not null,job_id uuid not null,attempt integer not null,
 model_id text not null default 'muse-spark-1.3' check(model_id='muse-spark-1.3'),prompt_version text not null default 'eventops-text-v1',
 reserved_usd numeric(9,6) not null default 0.15 check(reserved_usd=0.15),charged_usd numeric(9,6) not null default 0.15 check(charged_usd between 0 and 0.15),
 state text not null default 'reserved' check(state in ('reserved','finished','abandoned')),input_tokens integer,output_tokens integer,calls integer check(calls between 0 and 3),
 created_at timestamptz not null default now(),unique(job_id,attempt),foreign key(workspace_id,event_id,job_id) references public.analysis_jobs(workspace_id,event_id,id)
);
alter table public.model_runs enable row level security;
revoke all on public.model_runs from public,anon,authenticated,eventops_worker;
grant select on public.model_runs to authenticated;
create policy own_runs on public.model_runs for select to authenticated using(workspace_id in(select id from public.workspaces where owner_user_id=(select auth.uid()) and deletion_requested_at is null) and event_id in(select id from public.events where status<>'trashed'));
create table eventops_private.analysis_budget_lock(id integer primary key check(id=1));
insert into eventops_private.analysis_budget_lock values(1);
alter table public.proposals add column analysis_job_id uuid;
alter table public.proposals add column confirmed_requests jsonb;
alter table public.proposals add foreign key(workspace_id,event_id,analysis_job_id) references public.analysis_jobs(workspace_id,event_id,id);
create unique index one_analysis_proposal on public.proposals(analysis_job_id) where analysis_job_id is not null;

create function eventops_private.analysis_requests_valid(p jsonb) returns boolean language sql immutable set search_path='' as $schema$
 select extensions.jsonb_matches_schema('{"$schema":"https://json-schema.org/draft/2020-12/schema","minItems":1,"maxItems":20,"type":"array","items":{"oneOf":[{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"move_session"},"session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"room_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"time_choices":{"maxItems":20,"type":"array","items":{"type":"object","properties":{"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"start_offset":{"type":["string","null"]},"end_offset":{"type":["string","null"]}},"required":["start","end","start_offset","end_offset"],"additionalProperties":false}}},"required":["intent_id","span","action","session_id","room_id","time_choices"],"additionalProperties":false},{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"change_time"},"session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"time_choices":{"minItems":1,"maxItems":20,"type":"array","items":{"type":"object","properties":{"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"start_offset":{"type":["string","null"]},"end_offset":{"type":["string","null"]}},"required":["start","end","start_offset","end_offset"],"additionalProperties":false}}},"required":["intent_id","span","action","session_id","time_choices"],"additionalProperties":false},{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"cancel_session"},"session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"}},"required":["intent_id","span","action","session_id"],"additionalProperties":false},{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"change_assignment"},"session_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"from_volunteer_id":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"null"}]},"to_volunteer_id":{"anyOf":[{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},{"type":"null"}]},"find_replacement":{"type":"boolean"},"role_tag":{"type":"string","minLength":1,"maxLength":64}},"required":["intent_id","span","action","session_id","from_volunteer_id","to_volunteer_id","find_replacement","role_tag"],"additionalProperties":false},{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"record_availability"},"volunteer_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"status":{"type":"string","enum":["available","unavailable"]},"interval":{"type":"object","properties":{"start":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"end":{"type":"string","pattern":"^\\d{2}:\\d{2}$"},"start_offset":{"type":["string","null"]},"end_offset":{"type":["string","null"]}},"required":["start","end","start_offset","end_offset"],"additionalProperties":false}},"required":["intent_id","span","action","volunteer_id","status","interval"],"additionalProperties":false},{"type":"object","properties":{"intent_id":{"type":"string","pattern":"^[a-zA-Z0-9_-]{1,40}$"},"span":{"type":"object","properties":{"start":{"type":"integer","minimum":0,"maximum":10000},"end":{"type":"integer","exclusiveMinimum":0,"maximum":10000},"quote":{"type":"string","minLength":1,"maxLength":10000}},"required":["start","end","quote"],"additionalProperties":false},"action":{"type":"string","const":"change_room_facts"},"room_id":{"type":"string","format":"uuid","pattern":"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"},"capacity":{"anyOf":[{"type":"integer","exclusiveMinimum":0,"maximum":1000000},{"type":"null"}]},"feature_tags":{"maxItems":20,"type":"array","items":{"type":"string","minLength":1,"maxLength":64}}},"required":["intent_id","span","action","room_id","capacity","feature_tags"],"additionalProperties":false}]}}'::json,p);
$schema$;
create function eventops_private.analysis_id(seed text,request_id text,kind text) returns text language sql immutable set search_path='' as $$
 select (overlay(overlay(md5(seed||':'||request_id||':'||kind) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid)::text;
$$;
create function eventops_private.apply_analysis_intents(base jsonb,requests jsonb,seed text,confirmed_text text) returns jsonb
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
      t:=jsonb_build_object('start',to_char(((a->>'starts_at')::timestamptz+delta) at time zone (p#>>'{event,timezone}'),'HH24:MI'),'end',to_char(((a->>'ends_at')::timestamptz+delta) at time zone (p#>>'{event,timezone}'),'HH24:MI'),'start_offset',r#>'{time_choices,0,start_offset}','end_offset',r#>'{time_choices,0,end_offset}');
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
create function eventops_private.analysis_option_valid(envelope jsonb,requests jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare r jsonb;original jsonb;expected jsonb;
begin
 if eventops_private.analysis_requests_valid(requests) is distinct from true or jsonb_array_length(requests)<>jsonb_array_length(envelope->'intents') or jsonb_array_length(envelope->'questions')<>0 or jsonb_array_length(envelope->'unsupported_requests')<>0 then return false;end if;
 if (select count(distinct x->>'intent_id') from jsonb_array_elements(requests) x)<>jsonb_array_length(requests) then return false;end if;
 for r in select value from jsonb_array_elements(requests) loop
  select value into original from jsonb_array_elements(envelope->'intents') where value->>'intent_id'=r->>'intent_id';if original is null then return false;end if;expected:=original;
  if original ? 'time_choices' and jsonb_array_length(original->'time_choices')>0 then
   if jsonb_array_length(r->'time_choices')<>1 or not (original->'time_choices') @> (r->'time_choices') then return false;end if;expected:=jsonb_set(expected,'{time_choices}',r->'time_choices');
  end if;
  if original->>'action'='change_assignment' and (original->>'find_replacement')::boolean and original->>'to_volunteer_id' is null then
   if r->>'to_volunteer_id' is null then return false;end if;expected:=jsonb_set(expected,'{to_volunteer_id}',r->'to_volunteer_id');
  end if;
  if expected<>r then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;

alter table eventops_private.analysis_budget_lock add column enabled boolean not null default false;
create function eventops_private.reserve_analysis(j public.analysis_jobs,next_attempt integer) returns boolean
language plpgsql volatile set search_path='' as $$
declare global_total numeric;global_today numeric;workspace_today numeric;hour_count integer;
begin
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select coalesce(sum(charged_usd),0),coalesce(sum(charged_usd) filter(where (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),coalesce(sum(charged_usd) filter(where workspace_id=j.workspace_id and (created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date),0),count(*) filter(where workspace_id=j.workspace_id and created_at>now()-interval '1 hour') into global_total,global_today,workspace_today,hour_count from public.model_runs;
 if global_total+0.15>50 or global_today+0.15>10 or workspace_today+0.15>2 or hour_count>=10 or next_attempt>10 then return false;end if;
 insert into public.model_runs(workspace_id,event_id,job_id,attempt) values(j.workspace_id,j.event_id,j.id,next_attempt);return true;
end $$;
create function public.queue_analysis_job(p_event_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.analysis_jobs;draft public.text_update_drafts;
begin
 ev:=eventops_private.lock_event(p_event_id);
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 select * into j from public.analysis_jobs where id=p_job_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Job not found';end if;
 if j.state in ('queued','running','completed') then return to_jsonb(j);end if;
 if j.state not in ('blocked','failed') then raise sqlstate 'P0001' using message='Start a new confirmed update';end if;
 if not (select enabled from eventops_private.analysis_budget_lock where id=1) then raise sqlstate '42501' using message='Model access is not enabled';end if;
 select * into draft from public.text_update_drafts where id=j.draft_id;
 if draft.generation<>j.draft_generation or ev.current_revision_id<>j.base_revision_id then raise sqlstate 'P0001' using message='Stale plan';end if;
 if exists(select 1 from public.analysis_jobs where event_id=ev.id and state in ('queued','running')) or (select count(*) from public.analysis_jobs where workspace_id=ev.workspace_id and state in ('queued','running'))>=2 then raise sqlstate 'P0001' using message='Analysis concurrency limit';end if;
 if not eventops_private.reserve_analysis(j,j.attempts+1) then raise sqlstate 'P0001' using message='Analysis budget or rate limit';end if;
 update public.analysis_jobs set state='queued',stage='Queued',error_code=null,attempts=attempts+1,not_before=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

create function eventops_worker_api.claim() returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.analysis_jobs;token uuid;plan jsonb;txt text;source uuid;
begin
 perform 1 from eventops_private.analysis_budget_lock where id=1 for update;
 if not (select enabled from eventops_private.analysis_budget_lock where id=1) then return null;end if;
 select * into j from public.analysis_jobs where (state='queued' and not_before<=now()) or (state='running' and lease_until<now()) order by created_at for update skip locked limit 1;
 if j.id is null then return null;end if;
 if not exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id join public.text_update_drafts d on d.id=j.draft_id where e.id=j.event_id and e.workspace_id=j.workspace_id and e.status='active' and e.current_revision_id=j.base_revision_id and w.deletion_requested_at is null and d.generation=j.draft_generation) then
  update public.analysis_jobs set state='stale',stage='Review changed plan',error_code='STALE_INPUT',lease_token=null,lease_until=null where id=j.id;return null;
 end if;
 if j.state='running' then
  update public.model_runs set state='abandoned' where job_id=j.id and attempt=j.attempts;
  if j.attempts>=3 or not eventops_private.reserve_analysis(j,j.attempts+1) then update public.analysis_jobs set state='failed',stage='Analysis stopped',error_code='RETRY_LIMIT',lease_token=null,lease_until=null where id=j.id;return null;end if;
  j.attempts:=j.attempts+1;
 end if;
 token:=gen_random_uuid();
 update public.analysis_jobs set state='running',stage='Reading update',lease_token=token,lease_until=now()+interval '120 seconds',attempts=j.attempts,error_code=null where id=j.id;
 select snapshot into plan from public.revisions where id=j.base_revision_id and event_id=j.event_id;
 select confirmed_text into txt from public.updates where id=j.update_id and event_id=j.event_id;
 select id into source from public.source_records where event_id=j.event_id and record_id=j.update_id::text and field_path='confirmed_text';
 return jsonb_build_object('id',j.id,'lease_token',token,'base_revision_id',j.base_revision_id,'plan',plan,'text',txt,'source_id',source);
end $$;
create function eventops_worker_api.stage(p_job_id uuid,p_token uuid,p_stage text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_stage<>all(array['Reading update','Checking plan','Preparing options']) then return false;end if;
 update public.analysis_jobs j set stage=p_stage where j.id=p_job_id and j.lease_token=p_token and j.state='running' and j.lease_until>now() and exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id join public.text_update_drafts d on d.id=j.draft_id where e.id=j.event_id and e.status='active' and e.current_revision_id=j.base_revision_id and d.generation=j.draft_generation and w.deletion_requested_at is null);
 return found;
end $$;
create function eventops_worker_api.finish(p_job_id uuid,p_token uuid,p_result jsonb,p_error text,p_usage jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.analysis_jobs;valid boolean;option jsonb;candidate jsonb;base jsonb;txt text;reported boolean;input_count integer;output_count integer;call_count integer;cost numeric;
begin
 select * into j from public.analysis_jobs where id=p_job_id for update;
 if j.id is null or j.lease_token is distinct from p_token or j.state<>'running' or j.lease_until<=now() then return false;end if;
 reported:=coalesce((p_usage->>'reported')::boolean,false);input_count:=(p_usage->>'input_tokens')::integer;output_count:=(p_usage->>'output_tokens')::integer;call_count:=(p_usage->>'calls')::integer;
 if call_count is null or call_count not between 0 and 3 or input_count is null or input_count not between 0 and 48000 or output_count is null or output_count not between 0 and 12000 then raise sqlstate '22023' using message='Invalid usage envelope';end if;
 cost:=case when reported then (input_count*1.25+output_count*4.25)/1000000 else 0.15 end;
 update public.model_runs set state='finished',charged_usd=cost,input_tokens=input_count,output_tokens=output_count,calls=call_count where job_id=j.id and attempt=j.attempts;
 valid:=exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id join public.text_update_drafts d on d.id=j.draft_id where e.id=j.event_id and e.status='active' and e.current_revision_id=j.base_revision_id and d.generation=j.draft_generation and w.deletion_requested_at is null);
 if not valid then update public.analysis_jobs set state='stale',stage='Review changed plan',error_code='STALE_INPUT',lease_token=null,lease_until=null where id=j.id;return true;end if;
 if p_error is not null then
  if p_error<>all(array['PROVIDER_NETWORK','PROVIDER_RATE_LIMIT','PROVIDER_UNAVAILABLE','PROVIDER_ACCESS','PROVIDER_REQUEST','PROVIDER_SHAPE','PROVIDER_TOO_LARGE','PROVIDER_MODEL','PROVIDER_REFUSAL','CONTEXT_TOO_LARGE','ANALYSIS_LIMIT','INVALID_MODEL_JSON','ANALYSIS_FAILED','LEASE_LOST']) then p_error:='ANALYSIS_FAILED';end if;
  update public.analysis_jobs set state='failed',stage='Analysis stopped',error_code=p_error,lease_token=null,lease_until=null,completed_at=now() where id=j.id;return true;
 end if;
 if p_result is null or pg_column_size(p_result)>4194304 or p_result->>'status' not in ('ready_for_confirmation','unresolved') or jsonb_typeof(p_result->'options') is distinct from 'array' or jsonb_array_length(p_result->'options')>3 or jsonb_typeof(p_result->'questions') is distinct from 'array' or jsonb_array_length(p_result->'questions')>20 then raise sqlstate '22023' using message='Invalid result';end if;
 select snapshot into base from public.revisions where id=j.base_revision_id;select confirmed_text into txt from public.updates where id=j.update_id;
 if p_result#>>'{interpretation,base_revision_id}'<>j.base_revision_id::text then raise sqlstate '22023' using message='Wrong result base';end if;
 if p_result->>'status'='ready_for_confirmation' then
  if jsonb_array_length(p_result->'questions')<>0 or not exists(select 1 from jsonb_array_elements(p_result->'options') x where x->>'id'=p_result->>'selected_option_id') then raise sqlstate '22023' using message='Missing selected option';end if;
  for option in select value from jsonb_array_elements(p_result->'options') loop
   if not eventops_private.analysis_option_valid(p_result->'interpretation',option->'requests') then raise sqlstate '22023' using message='Unhandled interpreted request';end if;
   candidate:=eventops_private.apply_analysis_intents(base,option->'requests',j.id::text,txt);
   if jsonb_array_length(eventops_private.validate_plan(candidate))>0 then raise sqlstate '22023' using message='Invalid option';end if;
  end loop;
 end if;
 update public.analysis_jobs set state='completed',stage=case when p_result->>'status'='ready_for_confirmation' then 'Review interpreted requests' else 'Needs your review' end,result=p_result,result_digest=eventops_private.hash(p_result),error_code=null,lease_token=null,lease_until=null,completed_at=now() where id=j.id;
 return true;
end $$;

create function public.adopt_analysis_option(p_event_id uuid,p_job_id uuid,p_option_id text,p_result_digest text,p_confirmed boolean,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.analysis_jobs;option jsonb;base jsonb;candidate jsonb;coverage jsonb;patch jsonb:='[]';key text;proposal public.proposals;request text;txt text;draft public.text_update_drafts;
begin
 ev:=eventops_private.lock_event(p_event_id);
 if p_confirmed is distinct from true or p_key is null then raise sqlstate '22023' using message='Confirm complete interpretation and new facts';end if;
 select * into j from public.analysis_jobs where id=p_job_id and event_id=ev.id and workspace_id=ev.workspace_id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Job not found';end if;
 request:=eventops_private.hash(jsonb_build_object('job',p_job_id,'option',p_option_id,'result',p_result_digest));
 select * into proposal from public.proposals where event_id=ev.id and create_key=p_key;
 if proposal.id is not null then if proposal.request_digest<>request then raise sqlstate 'P0001' using message='Idempotency key reused';end if;return to_jsonb(proposal);end if;
 if j.state<>'completed' or j.result_digest is distinct from p_result_digest or j.result->>'status'<>'ready_for_confirmation' then raise sqlstate 'P0001' using message='Result not ready';end if;
 select * into draft from public.text_update_drafts where id=j.draft_id;
 if draft.generation<>j.draft_generation or ev.current_revision_id<>j.base_revision_id then raise sqlstate 'P0001' using message='Stale plan';end if;
 if exists(select 1 from public.proposals where analysis_job_id=j.id) then raise sqlstate 'P0001' using message='An option has already been confirmed';end if;
 select value into option from jsonb_array_elements(j.result->'options') where value->>'id'=p_option_id;if option is null or not eventops_private.analysis_option_valid(j.result->'interpretation',option->'requests') then raise sqlstate '22023' using message='Unknown or incomplete option';end if;
 select snapshot into base from public.revisions where id=j.base_revision_id;select confirmed_text into txt from public.updates where id=j.update_id;
 candidate:=eventops_private.apply_analysis_intents(base,option->'requests',j.id::text,txt);
 if jsonb_array_length(eventops_private.validate_plan(candidate))>0 then raise sqlstate '22023' using message='Option violates plan';end if;
 coverage:=eventops_private.request_coverage(base,candidate);if jsonb_array_length(coverage)=0 then raise sqlstate '22023' using message='No plan changes';end if;
 candidate:=eventops_private.capture_plan(candidate,base,ev.workspace_id,ev.id,auth.uid(),'analysis_confirmation');
 foreach key in array array['event','rooms','sessions','volunteers','availability','assignments','dependencies'] loop if base->key is distinct from candidate->key then patch:=patch||jsonb_build_array(jsonb_build_object('op','replace','path','/'||key,'value',candidate->key));end if;end loop;
 insert into public.proposals(workspace_id,event_id,update_id,base_revision_id,state,candidate_snapshot,canonical_patch,candidate_digest,patch_digest,constraint_report,request_coverage,validator_version,create_key,request_digest,analysis_job_id,confirmed_requests) values(ev.workspace_id,ev.id,j.update_id,j.base_revision_id,'ready',candidate,patch,eventops_private.hash(candidate),eventops_private.hash(patch),'[]',coverage,'plan-v1',p_key,request,j.id,option->'requests') returning * into proposal;
 return to_jsonb(proposal);
end $$;

revoke all on all functions in schema eventops_worker_api from public,anon,authenticated;
grant execute on all functions in schema eventops_worker_api to eventops_worker;
revoke all on function public.queue_analysis_job(uuid,uuid),public.adopt_analysis_option(uuid,uuid,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.queue_analysis_job(uuid,uuid),public.adopt_analysis_option(uuid,uuid,text,text,boolean,uuid) to authenticated;
revoke all on all functions in schema eventops_private from public,anon,authenticated,eventops_worker;

create or replace function public.approve_proposal(p_event_id uuid,p_proposal_id uuid,p_base_revision_id uuid,p_generation integer,p_candidate_digest text,p_idempotency_key uuid) returns jsonb
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
 if proposal.analysis_job_id is not null then
  if not exists(select 1 from public.analysis_jobs j join public.text_update_drafts d on d.id=j.draft_id where j.id=proposal.analysis_job_id and j.event_id=ev.id and j.state='completed' and d.generation=j.draft_generation) then raise sqlstate 'P0001' using message='Analysis input changed';end if;
  if jsonb_set(eventops_private.apply_analysis_intents(base,proposal.confirmed_requests,proposal.analysis_job_id::text,(select confirmed_text from public.updates where id=proposal.update_id)),'{provenance}',proposal.candidate_snapshot->'provenance')<>proposal.candidate_snapshot then raise sqlstate '22023' using message='Interpreted request coverage failed';end if;
 end if;
 if number>=500 then raise sqlstate '22023' using message='Revision limit reached';end if;
 candidate:=jsonb_set(eventops_private.apply_patch(base,proposal.canonical_patch),'{provenance}',proposal.candidate_snapshot->'provenance');
 if candidate<>proposal.candidate_snapshot or eventops_private.hash(candidate)<>p_candidate_digest or eventops_private.hash(proposal.canonical_patch)<>proposal.patch_digest or proposal.validator_version<>'plan-v1' or jsonb_array_length(eventops_private.validate_plan(candidate))>0 or not eventops_private.evidence_valid(candidate,base,ev.workspace_id,ev.id) or eventops_private.request_coverage(base,candidate)<>proposal.request_coverage then raise sqlstate '22023' using message='Plan constraints, evidence or requests failed';end if;
 insert into public.revisions(workspace_id,event_id,revision_number,snapshot,sha256,approved_by,reason,parent_revision_id,proposal_id) values(ev.workspace_id,ev.id,number+1,candidate,p_candidate_digest,auth.uid(),case when proposal.analysis_job_id is null then 'Approved manual changes' else 'Approved confirmed interpreted requests' end,ev.current_revision_id,proposal.id) returning id into revision;
 update public.events set current_revision_id=revision,name=candidate#>>'{event,name}' where id=ev.id;
 update public.proposals set state='approved' where id=proposal.id;
 insert into public.audit_events(workspace_id,event_id,action,actor,revision_id,proposal_id,safe_metadata) values(ev.workspace_id,ev.id,'proposal_approved',auth.uid(),revision,proposal.id,jsonb_build_object('revision_number',number+1));
 insert into public.approval_receipts(workspace_id,event_id,actor,operation,idempotency_key,request_digest,revision_id,candidate_digest) values(ev.workspace_id,ev.id,auth.uid(),'approve',p_idempotency_key,request,revision,p_candidate_digest) returning * into receipt;
 return to_jsonb(receipt);
end $$;

