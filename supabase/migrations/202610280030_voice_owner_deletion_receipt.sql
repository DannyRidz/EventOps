-- An owner can acknowledge physical deletion only after Storage metadata is absent.
create function public.ack_voice_deleted(p_event_id uuid,p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.events;j public.voice_jobs;
begin
 ev:=eventops_private.lock_event(p_event_id);
 select * into j from public.voice_jobs where id=p_job_id and event_id=ev.id for update;
 if j.id is null then raise sqlstate 'P0002' using message='Recording not found';end if;
 if j.delete_after<=now() and not exists(select 1 from storage.objects where bucket_id='event-audio' and name=j.object_key) then
  update public.voice_jobs set audio_deleted_at=coalesce(audio_deleted_at,now()) where id=j.id returning * into j;
 end if;
 return jsonb_build_object('id',j.id,'audio_deleted',j.audio_deleted_at is not null);
end $$;
revoke all on function public.ack_voice_deleted(uuid,uuid) from public,anon;
grant execute on function public.ack_voice_deleted(uuid,uuid) to authenticated;
