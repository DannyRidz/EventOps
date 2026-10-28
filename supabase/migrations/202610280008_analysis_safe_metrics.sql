-- Safe model-run metadata excludes raw prompts, transcripts and provider error bodies.
-- IF NOT EXISTS permits safe recovery from an interrupted local DDL application.
alter table public.model_runs add column if not exists request_ids jsonb not null default '[]';
alter table public.model_runs add column if not exists latency_ms integer not null default 0 check(latency_ms between 0 and 90000);
alter table public.model_runs add column if not exists constraint_failures integer not null default 0 check(constraint_failures between 0 and 100000);
alter table public.model_runs add column if not exists citation_failures integer not null default 0 check(citation_failures between 0 and 3);
create or replace function eventops_worker_api.finish(p_job_id uuid,p_token uuid,p_result jsonb,p_error text,p_usage jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare j public.analysis_jobs;valid boolean;option jsonb;candidate jsonb;base jsonb;txt text;reported boolean;input_count integer;output_count integer;call_count integer;cost numeric;
begin
 select * into j from public.analysis_jobs where id=p_job_id for update;
 if j.id is null or j.lease_token is distinct from p_token or j.state<>'running' or j.lease_until<=now() then return false;end if;
 if p_error is null and eventops_private.analysis_result_valid(p_result) is distinct from true then raise sqlstate '22023' using message='Invalid closed analysis result';end if;
 reported:=coalesce((p_usage->>'reported')::boolean,false);input_count:=(p_usage->>'input_tokens')::integer;output_count:=(p_usage->>'output_tokens')::integer;call_count:=(p_usage->>'calls')::integer;
 if call_count is null or call_count not between 0 and 3 or input_count is null or input_count not between 0 and 48000 or output_count is null or output_count not between 0 and 12000 then raise sqlstate '22023' using message='Invalid usage envelope';end if;
 if p_usage ? 'request_ids' and (jsonb_typeof(p_usage->'request_ids')<>'array' or jsonb_array_length(p_usage->'request_ids')>3 or exists(select 1 from jsonb_array_elements_text(p_usage->'request_ids') x where x !~ '^[A-Za-z0-9_-]{1,128}$')) then raise sqlstate '22023' using message='Invalid safe request IDs';end if;
 cost:=case when reported then (input_count*1.25+output_count*4.25)/1000000 else 0.15 end;
 update public.model_runs set request_ids=coalesce(p_usage->'request_ids','[]'::jsonb),latency_ms=coalesce((p_usage->>'latency_ms')::integer,0),constraint_failures=coalesce((p_usage->>'constraint_failures')::integer,0),citation_failures=coalesce((p_usage->>'citation_failures')::integer,0),state='finished',charged_usd=cost,input_tokens=input_count,output_tokens=output_count,calls=call_count where job_id=j.id and attempt=j.attempts;
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

