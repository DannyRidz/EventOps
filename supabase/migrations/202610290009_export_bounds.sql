-- Worker raw reads cannot outlive event retention; due deletion remains available.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.voice_object_access(text,boolean)'::regprocedure);
 definition:=replace(definition,'not p_delete and e.status=''active'' and w.deletion_requested_at is null','not p_delete and e.status=''active'' and eventops_private.event_deadline(e)>now() and w.deletion_requested_at is null');
 execute definition;
end $$;
create or replace function public.workspace_export() returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare w public.workspaces;t text;rows jsonb;result jsonb;total bigint:=0;bytes bigint;
begin
 select * into w from public.workspaces where owner_user_id=auth.uid() and deletion_requested_at is null for share;
 if w.id is null then raise sqlstate 'P0002' using message='Workspace not found';end if;
 -- Preflight every relation before aggregating any content. Per-row serialization
 -- is bounded by existing input contracts; the sum itself uses constant memory.
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='event_id' union select 'events' loop
 execute format('select coalesce(sum(pg_column_size(to_jsonb(r)-''original_bytes'')),0) from public.%I r where r.workspace_id=$1',t) into bytes using w.id;
 total:=total+bytes;
 if total>33554432 then raise sqlstate '54000' using message='Export limit reached';end if;
 end loop;
 result:=jsonb_build_object('workspace',to_jsonb(w),'profile',(select to_jsonb(p) from public.profiles p where user_id=auth.uid()),'events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.events e where workspace_id=w.id and eventops_private.event_deadline(e)>now()));
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='event_id' loop
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-''original_bytes''),''[]'') from public.%I r join public.events e on e.id=r.event_id where r.workspace_id=$1 and eventops_private.event_deadline(e)>now()',t) into rows using w.id;
 result:=result||jsonb_build_object(t,rows);
 end loop;
 return result;
end $$;
