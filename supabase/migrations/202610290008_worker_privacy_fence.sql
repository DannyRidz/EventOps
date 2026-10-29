-- Worker audio reads require a live event and workspace; due deletion remains possible.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.voice_object_access(text,boolean)'::regprocedure);
 definition:=replace(definition,'(not p_delete or j.delete_after<=now())','((not p_delete and e.status=''active'' and w.deletion_requested_at is null) or (p_delete and j.delete_after<=now()))');
 execute definition;
end $$;
