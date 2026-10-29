-- T8 lifecycle and bounded restricted maintenance. Live provider gates are unchanged.
alter table public.workspaces add column purge_after timestamptz;
alter table public.workspaces add column lifecycle_generation integer not null default 1;
alter table public.events add column retention_days integer not null default 90 check(retention_days in (30,90,365));
alter table public.events add column archived_at timestamptz;
alter table public.events add column trashed_at timestamptz;
alter table public.events add column purge_after timestamptz;
alter table public.events add column lifecycle_generation integer not null default 1;
create function eventops_private.retention_deadline(e public.events, days integer) returns timestamptz language sql stable set search_path='' as $$
 select (((e.create_snapshot->>'date')::date+days+1)::timestamp at time zone (e.create_snapshot->>'timezone'));
$$;
create function eventops_private.event_deadline(e public.events) returns timestamptz language sql stable security definer set search_path='' as $$
 select least(eventops_private.retention_deadline(e,e.retention_days),e.purge_after,
 case when e.current_revision_id is null then (select saved_at+interval '30 days' from public.plan_drafts where event_id=e.id) end);
$$;
create function public.lifecycle_settings() returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces;r jsonb;
begin
 select * into w from public.workspaces where owner_user_id=auth.uid();
 if w.id is null then raise sqlstate 'P0002' using message='Workspace not found';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'retention_days',e.retention_days,'generation',e.lifecycle_generation,'event_date',e.create_snapshot->>'date','timezone',e.create_snapshot->>'timezone','retention_deadline',eventops_private.retention_deadline(e,e.retention_days),'purge_after',eventops_private.event_deadline(e)) order by e.created_at desc),'[]') into r from public.events e where workspace_id=w.id;
 return jsonb_build_object('workspace_id',w.id,'generation',w.lifecycle_generation,'deletion_requested_at',w.deletion_requested_at,'purge_after',w.purge_after,'events',case when w.deletion_requested_at is null then r else '[]'::jsonb end);
end $$;
create function public.change_event_lifecycle(p_event_id uuid,p_generation integer,p_action text,p_days integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces;e public.events;target text;
begin
 select * into w from public.workspaces where owner_user_id=auth.uid() and deletion_requested_at is null for update;
 select * into e from public.events where id=p_event_id and workspace_id=w.id for update;
 if e.id is null then raise sqlstate 'P0002' using message='Event not found';end if;
 if e.lifecycle_generation is distinct from p_generation or eventops_private.event_deadline(e)<=now() then raise sqlstate 'P0001' using message='Lifecycle changed or expired';end if;
 if p_action='retention' then
  if e.status='trashed' or p_days is null or p_days not in (30,90,365) then raise sqlstate '22023' using message='Invalid retention';end if;
  update public.events set retention_days=p_days where id=e.id;
 elsif p_action='trash' then
  if e.status='trashed' then raise sqlstate 'P0001' using message='Already trashed';end if;
  update public.events set status='trashed',trashed_at=now(),purge_after=now()+interval '7 days' where id=e.id;
 elsif p_action='archive' then
  if e.status not in ('draft','active') then raise sqlstate 'P0001' using message='Cannot archive';end if;
  update public.events set status='archived',archived_at=now() where id=e.id;
 elsif p_action in ('restore','reopen') then
  if (p_action='restore' and e.status<>'trashed') or (p_action='reopen' and e.status<>'archived') then raise sqlstate 'P0001' using message='Cannot restore';end if;
  if (select count(*) from public.events where workspace_id=w.id and status in ('draft','active'))>=10 then raise sqlstate 'P0001' using message='Event limit reached';end if;
  target:=case when e.current_revision_id is null then 'draft' else 'active' end;
  update public.events set status=target,trashed_at=null,purge_after=null,archived_at=null where id=e.id;
 else raise sqlstate '22023' using message='Unknown lifecycle action';end if;
 update public.events set lifecycle_generation=lifecycle_generation+1 where id=e.id;
 update public.workspaces set lifecycle_generation=lifecycle_generation+1 where id=w.id;
 if p_action in ('trash','archive') then
  update public.analysis_jobs set state='cancelled',stage='Cancelled',lease_token=null,lease_until=null where event_id=e.id and state in ('blocked','queued','running');
  update public.voice_jobs set state='discarded',lease_token=null,lease_until=null,delete_after=now() where event_id=e.id and state in ('uploading','queued','running');
 end if;
 return public.lifecycle_settings();
end $$;
create function public.change_account_lifecycle(p_generation integer,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces;recent boolean;sid uuid;
begin
 select * into w from public.workspaces where owner_user_id=auth.uid() for update;
 if w.id is null then raise sqlstate 'P0002' using message='Workspace not found';end if;
 if w.lifecycle_generation is distinct from p_generation then raise sqlstate 'P0001' using message='Lifecycle changed';end if;
 if p_action='delete' then
  sid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
  execute 'select exists(select 1 from auth.sessions where id=$1 and user_id=$2 and created_at>now()-interval ''10 minutes'')' into recent using sid,auth.uid();
  if recent is distinct from true then raise sqlstate '42501' using message='Recent sign in required';end if;
  if w.deletion_requested_at is not null then raise sqlstate 'P0001' using message='Deletion already requested';end if;
  update public.workspaces set deletion_requested_at=now(),purge_after=now()+interval '7 days',lifecycle_generation=lifecycle_generation+1 where id=w.id;
  update public.analysis_jobs set state='cancelled',stage='Cancelled',lease_token=null,lease_until=null where workspace_id=w.id and state in ('blocked','queued','running');
  update public.voice_jobs set state='discarded',lease_token=null,lease_until=null,delete_after=now() where workspace_id=w.id and state in ('uploading','queued','running');
 elsif p_action='recover' then
  if w.deletion_requested_at is null or w.purge_after<=now() then raise sqlstate 'P0001' using message='Recovery unavailable';end if;
  update public.workspaces set deletion_requested_at=null,purge_after=null,lifecycle_generation=lifecycle_generation+1 where id=w.id;
 else raise sqlstate '22023' using message='Unknown account action';end if;
 return public.lifecycle_settings();
end $$;
-- Central lock also enforces retention before every existing owner mutation.
create or replace function eventops_private.lock_event(e uuid) returns public.events language plpgsql volatile security definer set search_path='' as $$
declare ev public.events;w public.workspaces;actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required';end if;
 select ws.* into w from public.workspaces ws join public.memberships m on m.workspace_id=ws.id and m.user_id=actor and m.role='owner' where ws.owner_user_id=actor for update of ws;
 if w.id is null or w.deletion_requested_at is not null then raise sqlstate 'P0002' using message='Event not found';end if;
 select * into ev from public.events where id=e and workspace_id=w.id for update;
 if ev.id is null or ev.status in ('trashed','archived') or eventops_private.event_deadline(ev)<=now() then raise sqlstate 'P0002' using message='Event not found';end if;
 return ev;
end $$;
-- Restrictive read fence covers every event content table, including future permissive policies.
create function public.retained_event(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where e.id=p_id and w.owner_user_id=auth.uid() and w.deletion_requested_at is null and e.status<>'trashed' and eventops_private.event_deadline(e)>now());
$$;
do $$ declare t text;begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='event_id' loop
 execute format('create policy retained_content on public.%I as restrictive for select to authenticated using(public.retained_event(event_id))',t);
 end loop;
end $$;
create policy retained_event on public.events as restrictive for select to authenticated using(public.retained_event(id));
-- Event creation uses the existing validator, with active quota and expiry protections.
create or replace function public.save_event(p_snapshot jsonb, p_request_id uuid, p_event_id uuid default null, p_expected_generation integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); workspace uuid; result uuid; existing jsonb; zone text;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null and is_anonymous=false) then raise sqlstate '42501' using message='Verified email required'; end if;
 select id into workspace from public.workspaces where owner_user_id=actor;
 if workspace is null then raise sqlstate '42501' using message='Workspace required'; end if;
 perform 1 from public.workspaces where id=workspace and deletion_requested_at is null for update;
 if not found then raise sqlstate 'P0002' using message='Workspace not found';end if;
 if p_event_id is not null then perform eventops_private.lock_event(p_event_id);end if;
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
  if (select count(*) from public.events where workspace_id=workspace and status in ('draft','active')) >= 10 then raise sqlstate 'P0001' using message='Event limit reached'; end if;
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


-- Raw receipts may only be erased, never rewritten. Frozen cells stay immutable.
alter table public.import_files alter column original_bytes drop not null;
alter table public.import_files add column content_deleted_at timestamptz;
create function eventops_private.erase_receipt_only() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['original_bytes','content_deleted_at'])<>(to_jsonb(old)-array['original_bytes','content_deleted_at']) or new.original_bytes is not null or new.content_deleted_at is null or old.content_deleted_at is not null then raise sqlstate '42501' using message='Record is immutable';end if;
 return new;
end $$;
drop trigger immutable_record on public.import_files;
create trigger immutable_record before update on public.import_files for each row execute function eventops_private.erase_receipt_only();
create table eventops_private.raw_deletions(artifact_id uuid primary key references public.source_artifacts(id) on delete cascade,requested_at timestamptz not null default now());
create function public.delete_csv_original(p_event_id uuid,p_artifact_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 e:=eventops_private.lock_event(p_event_id);
 if not exists(select 1 from public.source_artifacts where id=p_artifact_id and event_id=e.id and kind='csv') then raise sqlstate 'P0002' using message='Original not found';end if;
 insert into eventops_private.raw_deletions(artifact_id) values(p_artifact_id) on conflict do nothing;
end $$;
create function public.csv_original_available(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.source_artifacts a where a.id=p_id and a.kind='csv' and public.retained_event(a.event_id) and a.captured_at+interval '30 days'>now() and not exists(select 1 from eventops_private.raw_deletions d where d.artifact_id=a.id));
$$;
create function eventops_private.object_due(bucket text,path text) returns boolean language sql stable security definer set search_path='' as $$
 select bucket in ('event-imports','event-audio') and (
 exists(select 1 from public.events e join public.workspaces w on w.id=e.workspace_id where split_part(path,'/',1)=w.id::text and split_part(path,'/',2)=e.id::text and (eventops_private.event_deadline(e)<=now() or w.purge_after<=now())) or
 (bucket='event-imports' and exists(select 1 from public.source_artifacts a where a.object_key=path and (a.captured_at+interval '30 days'<=now() or exists(select 1 from eventops_private.raw_deletions d where d.artifact_id=a.id)))) or
 (bucket='event-audio' and exists(select 1 from public.voice_jobs j where j.object_key=path and j.delete_after<=now())) or
 (not exists(select 1 from public.source_artifacts where object_key=path) and not exists(select 1 from public.voice_jobs where object_key=path) and exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=path and o.created_at<now()-interval '1 hour')));
$$;
create function public.retention_object_access(p_bucket text,p_path text,p_delete boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case when current_setting('request.jwt.claims',true)::jsonb->>'role'='eventops_worker' then eventops_private.object_due(p_bucket,p_path)
 else not p_delete and exists(select 1 from public.events e where e.id::text=split_part(p_path,'/',2) and e.workspace_id::text=split_part(p_path,'/',1) and public.retained_event(e.id)) and
 case when p_bucket='event-imports' then not exists(select 1 from public.source_artifacts a where a.object_key=p_path and not public.csv_original_available(a.id)) when p_bucket='event-audio' then public.voice_object_access(p_path) else false end end;
$$;
-- Intersect existing owner upload/read policies; permit worker deletion of due objects only.
create policy retention_owner_files on storage.objects as restrictive for select to authenticated using(bucket_id not in ('event-imports','event-audio') or public.retention_object_access(bucket_id,name));
drop policy voice_worker_scope on storage.objects;
create policy retention_worker_scope on storage.objects as restrictive for all to eventops_worker using(public.retention_object_access(bucket_id,name,true) or (bucket_id='event-audio' and public.voice_object_access(name))) with check(false);
create policy retention_worker_read on storage.objects for select to eventops_worker using(public.retention_object_access(bucket_id,name,true));
create policy retention_worker_delete on storage.objects for delete to eventops_worker using(public.retention_object_access(bucket_id,name,true));
-- Every circular application FK still checks at commit, permitting an atomic event purge.
do $$ declare r record;begin
 for r in select c.conrelid::regclass as tbl,c.conname from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f' loop
 execute format('alter table %s alter constraint %I deferrable initially immediate',r.tbl,r.conname);
 end loop;
end $$;
create table eventops_private.deletion_tombstones(kind text not null check(kind in ('event','account')),id uuid not null,deleted_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '8 days',primary key(kind,id));
create function eventops_worker_api.retention_sweep() returns jsonb language plpgsql security definer set search_path='' as $$
declare objects jsonb;targets jsonb;
begin
 -- No linked confirmation or job may lose its acknowledged text.
 delete from public.text_update_drafts d where saved_at<now()-interval '30 days' and not exists(select 1 from public.analysis_jobs j where j.draft_id=d.id) and not exists(select 1 from public.voice_jobs v where v.draft_id=d.id);
 update public.import_files f set original_bytes=null,content_deleted_at=now() where content_deleted_at is null and exists(select 1 from public.source_artifacts a where a.id=f.artifact_id and (a.captured_at+interval '30 days'<=now() or exists(select 1 from eventops_private.raw_deletions d where d.artifact_id=a.id))) and not exists(select 1 from public.source_artifacts a join storage.objects o on o.name=a.object_key and o.bucket_id='event-imports' where a.id=f.artifact_id);
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]') into objects from (select bucket_id,name from storage.objects where eventops_private.object_due(bucket_id,name) order by created_at limit 100) o;
 select coalesce(jsonb_agg(t),'[]') into targets from (
 select 'event' as kind,e.id from public.events e join public.workspaces w on w.id=e.workspace_id where eventops_private.event_deadline(e)<=now() or w.purge_after<=now()
 union all select 'account',owner_user_id from public.workspaces where purge_after<=now() limit 100) t;
 return jsonb_build_object('objects',objects,'targets',targets);
end $$;
create function eventops_private.purge_event(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t text;
begin
 set constraints all deferred;
 -- Only event scoped tables are candidates. All foreign keys remain checked.
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='event_id' loop
 execute format('delete from public.%I where event_id=$1',t) using p_id;
 end loop;
 delete from public.events where id=p_id;
end $$;
create function eventops_worker_api.retention_purge(p_kind text,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare w public.workspaces;e public.events;
begin
 if p_kind='event' then
  select ws.* into w from public.workspaces ws join public.events ev on ev.workspace_id=ws.id where ev.id=p_id for update of ws;
  select * into e from public.events where id=p_id for update;
  if e.id is null then return true;end if;
  if eventops_private.event_deadline(e)>now() and (w.purge_after is null or w.purge_after>now()) then return false;end if;
  if exists(select 1 from storage.objects where bucket_id in ('event-imports','event-audio') and split_part(name,'/',2)=e.id::text) then return false;end if;
  insert into eventops_private.deletion_tombstones(kind,id) values('event',p_id) on conflict do nothing;
  perform eventops_private.purge_event(p_id);
 elsif p_kind='account' then
  select * into w from public.workspaces where owner_user_id=p_id for update;
  if w.id is null then return not exists(select 1 from auth.users where id=p_id);end if;
  if w.purge_after is null or w.purge_after>now() or exists(select 1 from public.events where workspace_id=w.id) or exists(select 1 from storage.objects where bucket_id in ('event-imports','event-audio') and split_part(name,'/',1)=w.id::text) then return false;end if;
  insert into eventops_private.deletion_tombstones(kind,id) values('account',p_id) on conflict do nothing;
  delete from public.memberships where workspace_id=w.id;
  delete from public.workspaces where id=w.id;
  delete from public.profiles where user_id=p_id;
  delete from auth.users where id=p_id;
 else raise sqlstate '22023' using message='Unknown deletion kind';end if;
 return true;
end $$;
create function public.workspace_export() returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workspaces;t text;rows jsonb;result jsonb;
begin
 select * into w from public.workspaces where owner_user_id=auth.uid() and deletion_requested_at is null for share;
 if w.id is null then raise sqlstate 'P0002' using message='Workspace not found';end if;
 result:=jsonb_build_object('workspace',to_jsonb(w),'profile',(select to_jsonb(p) from public.profiles p where user_id=auth.uid()),'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.events e where workspace_id=w.id and eventops_private.event_deadline(e)>now()));
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='event_id' loop
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-''original_bytes''),''[]'') from public.%I r join public.events e on e.id=r.event_id where r.workspace_id=$1 and eventops_private.event_deadline(e)>now()',t) into rows using w.id;
 result:=result||jsonb_build_object(t,rows);
 if pg_column_size(result)>50331648 then raise sqlstate '54000' using message='Export limit reached';end if;
 end loop;
 return result;
end $$;
create function eventops_worker_api.retention_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('due_objects',(select count(*) from storage.objects where eventops_private.object_due(bucket_id,name)),'oldest_queue_seconds',(select coalesce(extract(epoch from now()-min(created_at)),0)::integer from public.analysis_jobs where state='queued'),'pending_purges',(select count(*) from public.events e where eventops_private.event_deadline(e)<=now()));
$$;
revoke all on all functions in schema eventops_private from public,anon,authenticated,eventops_worker;
revoke all on function public.lifecycle_settings(),public.change_event_lifecycle(uuid,integer,text,integer),public.change_account_lifecycle(integer,text),public.retained_event(uuid),public.csv_original_available(uuid),public.delete_csv_original(uuid,uuid),public.retention_object_access(text,text,boolean),public.workspace_export() from public,anon;
grant execute on function public.lifecycle_settings(),public.change_event_lifecycle(uuid,integer,text,integer),public.change_account_lifecycle(integer,text),public.retained_event(uuid),public.csv_original_available(uuid),public.delete_csv_original(uuid,uuid),public.workspace_export() to authenticated;
grant execute on function public.retention_object_access(text,text,boolean) to authenticated,eventops_worker;
revoke all on function eventops_worker_api.retention_sweep(),eventops_worker_api.retention_purge(text,uuid),eventops_worker_api.retention_health() from public,anon,authenticated;
grant execute on function eventops_worker_api.retention_sweep(),eventops_worker_api.retention_purge(text,uuid),eventops_worker_api.retention_health() to eventops_worker;
create function public.service_ready() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from eventops_private.analysis_budget_lock where id=1); $$;
revoke all on function public.service_ready() from public;
grant execute on function public.service_ready() to anon,authenticated;
