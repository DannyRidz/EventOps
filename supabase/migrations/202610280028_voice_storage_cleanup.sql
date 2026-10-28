-- Storage deletion needs SELECT visibility of due objects. Authenticated owners
-- still pass the existing owner check. No overwrite policy is added.
drop policy voice_read on storage.objects;
create policy voice_read on storage.objects for select to authenticated,eventops_worker using(bucket_id='event-audio' and (public.voice_object_access(name) or public.voice_object_access(name,true)));
-- Fail closed if a future operator broadens the restricted role or disables RLS.
do $$ begin
 if exists(select 1 from pg_roles where rolname='eventops_worker' and (rolsuper or rolbypassrls or rolcanlogin)) or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then raise exception 'Restricted audio storage role and RLS required';end if;
end $$;
-- A restrictive policy intersects every permissive policy, including future ones.
-- The worker can read only registered EventOps audio and delete only due audio.
create policy voice_worker_scope on storage.objects as restrictive for all to eventops_worker using(bucket_id='event-audio' and (public.voice_object_access(name) or public.voice_object_access(name,true))) with check(false);
grant usage on schema storage to eventops_worker;
grant select,delete on storage.objects to eventops_worker;
-- Authenticator can select this NOLOGIN, NOBYPASSRLS role for a signed worker JWT.
-- It gains no owner membership or direct application table privileges.
grant eventops_worker to authenticator;
