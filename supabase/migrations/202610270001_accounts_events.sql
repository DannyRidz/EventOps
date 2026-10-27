create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 adult_attested_at timestamptz not null default now(),
 terms_version text not null check (terms_version = '2026-10-27'),
 privacy_version text not null check (privacy_version = '2026-10-27')
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null unique references public.profiles(user_id),
 name text not null default 'My workspace', created_at timestamptz not null default now()
);
create table public.memberships (
 workspace_id uuid primary key references public.workspaces(id),
 user_id uuid not null references public.profiles(user_id),
 role text not null default 'owner' check (role = 'owner'), unique(workspace_id,user_id)
);
create table public.events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 request_id uuid not null, create_snapshot jsonb not null, name text not null check(length(name) between 1 and 120),
 status text not null default 'draft' check(status = 'draft'),
 created_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,request_id)
);
create table public.plan_drafts (
 event_id uuid primary key, workspace_id uuid not null,
 generation integer not null default 1 check(generation > 0), schema_version integer not null default 1 check(schema_version=1),
 snapshot jsonb not null, saved_at timestamptz not null default now(),
 foreign key(workspace_id,event_id) references public.events(workspace_id,id)
);
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.plan_drafts enable row level security;
create policy own_profile on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy own_workspace on public.workspaces for select to authenticated using(owner_user_id=(select auth.uid()));
create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy own_events on public.events for select to authenticated using(workspace_id in (select id from public.workspaces));
create policy own_drafts on public.plan_drafts for select to authenticated using(workspace_id in (select id from public.workspaces));
revoke all on public.profiles,public.workspaces,public.memberships,public.events,public.plan_drafts from anon,authenticated;
grant select on public.profiles,public.workspaces,public.memberships,public.events,public.plan_drafts to authenticated;

create function public.bootstrap_workspace(p_attested boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required'; end if;
 if p_attested is distinct from true then raise sqlstate '22023' using message='Attestation required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 insert into public.profiles(user_id,terms_version,privacy_version) values(actor,'2026-10-27','2026-10-27') on conflict do nothing;
 insert into public.workspaces(owner_user_id) values(actor) on conflict do nothing;
 select id into result from public.workspaces where owner_user_id=actor;
 insert into public.memberships(workspace_id,user_id) values(result,actor) on conflict do nothing;
 return result;
end $$;
revoke all on function public.bootstrap_workspace(boolean) from public,anon;
grant execute on function public.bootstrap_workspace(boolean) to authenticated;

create function public.save_event(p_snapshot jsonb, p_request_id uuid, p_event_id uuid default null, p_expected_generation integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); workspace uuid; result uuid; existing jsonb; zone text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required'; end if;
 select id into workspace from public.workspaces where owner_user_id=actor;
 if workspace is null then raise sqlstate '42501' using message='Workspace required'; end if;
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
  update public.plan_drafts set snapshot=p_snapshot,generation=generation+1,saved_at=clock_timestamp() where event_id=result and workspace_id=workspace and generation=p_expected_generation;
  if not found then raise sqlstate 'P0001' using message='Draft changed'; end if;
  update public.events set name=btrim(p_snapshot->>'name') where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_event(jsonb,uuid,uuid,integer) from public,anon;
grant execute on function public.save_event(jsonb,uuid,uuid,integer) to authenticated;
