-- Separate 24-hour command identity from seven-day, content-free run metadata.
alter table public.ai_tasks alter column client_key drop not null;
alter table public.ai_tasks alter column fingerprint drop not null;
update public.ai_tasks set fingerprint=encode(sha256(convert_to(fingerprint||':'||policy_digest,'UTF8')),'hex') where fingerprint is not null;

create or replace function public.cs_ai_prune() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(216220003);
  update public.ai_tasks set state='abandoned',finished_at=clock_timestamp() where state in ('reserved','running') and deadline<=clock_timestamp();
  update public.ai_runs set state='unknown',finished_at=clock_timestamp() where state='running' and created_at<clock_timestamp()-interval '1 minute';
  update public.ai_tasks set client_key=null,fingerprint=null where created_at<=clock_timestamp()-interval '24 hours' and state not in ('reserved','running');
  delete from public.usage_reservations where expires_at<=clock_timestamp();
  delete from public.ai_explanation_cache where expires_at<=clock_timestamp();
  delete from public.ai_runs where created_at<clock_timestamp()-interval '7 days';
  delete from public.ai_tasks where created_at<clock_timestamp()-interval '7 days' and not exists(select 1 from public.ai_runs where task_id=public.ai_tasks.id);
  delete from public.service_leases where coalesce(expires_at,'epoch')<=clock_timestamp() and coalesce(cooldown_until,'epoch')<=clock_timestamp()
    and (failures=0 or coalesce(failure_started_at,'epoch')<=clock_timestamp()-interval '60 seconds');
end $$;

create or replace function public.cs_ai_begin_task(p_owner uuid,p_actor text,p_role text,p_key uuid,p_fingerprint text,p_policy text,p_seconds integer,p_buckets jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare task public.ai_tasks; active_until timestamptz; admitted jsonb; task_id uuid:=gen_random_uuid(); t timestamptz:=clock_timestamp(); bound_fingerprint text;
begin
  perform pg_advisory_xact_lock(216220003);
  if p_seconds not between 1 and 30 or p_key is null or p_fingerprint is null or p_policy is null or not(p_fingerprint ~ '^[0-9a-f]{64}$') or not(p_policy ~ '^[0-9a-f]{64}$') then raise exception 'INVALID_ADMISSION'; end if;
  perform public.cs_ai_prune();
  select * into task from public.ai_tasks where actor_hash=p_actor and role=p_role and client_key=p_key;
  if found then
    -- Recompute against the original frozen policy, so config edits never change in-flight identity.
    bound_fingerprint:=encode(sha256(convert_to(p_fingerprint||':'||task.policy_digest,'UTF8')),'hex');
    if task.fingerprint<>bound_fingerprint then return jsonb_build_object('code','AI_TASK_CONFLICT'); end if;
    return jsonb_build_object('code',case when task.state in ('reserved','running') then 'AI_TASK_IN_PROGRESS' else 'AI_TASK_FINISHED' end);
  end if;
  select max(deadline) into active_until from public.ai_tasks where actor_hash=p_actor and state in ('reserved','running');
  if active_until>t then return jsonb_build_object('code','AI_RATE_LIMITED','retryAfter',greatest(1,ceil(extract(epoch from active_until-t))::integer)); end if;
  admitted:=public.cs_reserve_usage(task_id,p_buckets);
  if not (admitted->>'allowed')::boolean then return admitted||jsonb_build_object('code','AI_RATE_LIMITED'); end if;
  bound_fingerprint:=encode(sha256(convert_to(p_fingerprint||':'||p_policy,'UTF8')),'hex');
  insert into public.ai_tasks(id,owner_id,actor_hash,role,client_key,fingerprint,policy_digest,deadline)
    values(task_id,p_owner,p_actor,p_role,p_key,bound_fingerprint,p_policy,t+make_interval(secs=>p_seconds));
  return jsonb_build_object('id',task_id,'deadline',t+make_interval(secs=>p_seconds));
end $$;

create function public.cs_ai_retention_preview() returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
  select jsonb_build_object(
    'expiredReservations',(select count(*) from public.usage_reservations where expires_at<=clock_timestamp()),
    'expiredCodeCache',(select count(*) from public.ai_explanation_cache where expires_at<=clock_timestamp()),
    'expiredTaskKeys',(select count(*) from public.ai_tasks where client_key is not null and created_at<=clock_timestamp()-interval '24 hours'),
    'oldRunMetadata',(select count(*) from public.ai_runs where created_at<clock_timestamp()-interval '7 days'),
    'abandonedTasks',(select count(*) from public.ai_tasks where state in ('reserved','running') and deadline<=clock_timestamp()));
$$;
revoke all on function public.cs_ai_retention_preview() from public,anon,authenticated;
grant execute on function public.cs_ai_retention_preview() to service_role;
