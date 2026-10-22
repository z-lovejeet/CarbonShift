-- M06 operational state. No raw prompts, extracted constraints or model prose.
create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  actor_hash text not null check (actor_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('constraints','explanation')),
  client_key uuid not null, fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  policy_digest text not null check (policy_digest ~ '^[0-9a-f]{64}$'),
  state text not null default 'reserved' check (state in ('reserved','running','succeeded','failed','abandoned')),
  deadline timestamptz not null, created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz, unique(actor_hash,role,client_key)
);
create index ai_tasks_active on public.ai_tasks(actor_hash,deadline) where state in ('reserved','running');
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.ai_tasks(id),
  attempt integer not null check (attempt between 1 and 2), request_id uuid not null,
  provider text not null check (provider in ('gemini','groq')), model text not null,
  prompt_version text not null, schema_version integer not null default 1 check (schema_version=1),
  policy_digest text not null, state text not null default 'running' check(state in ('running','succeeded','transient','rate_limited','invalid','refused','configuration','unknown')),
  input_tokens bigint check(input_tokens>=0), output_tokens bigint check(output_tokens>=0), total_tokens bigint check(total_tokens>=0),
  latency_ms integer check(latency_ms>=0), created_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
  unique(task_id,attempt)
);
create table public.usage_reservations (
  id bigint generated always as identity primary key, operation_id uuid not null,
  bucket_hash text not null check (bucket_hash ~ '^[0-9a-f]{64}$'), metric text not null check(metric in ('requests','input_tokens','output_tokens','total_tokens')),
  amount bigint not null check(amount>=0), created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  unique(operation_id,bucket_hash,metric)
);
create index usage_reservations_active on public.usage_reservations(bucket_hash,metric,expires_at);
create table public.service_leases (
  scope text primary key check(scope ~ '^[0-9a-f]{64}$'), holder uuid, fencing bigint not null default 0,
  expires_at timestamptz, cooldown_until timestamptz, failure_started_at timestamptz, failures integer not null default 0 check(failures>=0)
);
create table public.ai_explanation_cache (
  owner_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  cache_key text not null check(cache_key ~ '^[0-9a-f]{64}$'), selection jsonb not null,
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  primary key(owner_id,comparison_id,cache_key), check(expires_at>created_at and expires_at<=created_at+interval '24 hours'),
  foreign key(comparison_id,owner_id) references public.comparisons(id,owner_id)
);

-- One short transaction mutex serializes multi-bucket admission in a stable order.
-- It is never held during a provider/network request. Shared by all app instances.
create function public.cs_reserve_usage(p_operation uuid,p_buckets jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare b jsonb; t timestamptz:=clock_timestamp(); used bigint; needed bigint; released bigint;
  retry_at timestamptz:=t; release_row record; existing public.usage_reservations; cap bigint; amount bigint;
begin
  if jsonb_typeof(p_buckets)<>'array' or jsonb_array_length(p_buckets)>32 then raise exception 'INVALID_ADMISSION'; end if;
  perform pg_advisory_xact_lock(216220003);
  for b in select value from jsonb_array_elements(p_buckets) order by value->>'key',value->>'metric' loop
    if not (b->>'key' ~ '^[0-9a-f]{64}$') or b->>'metric' not in ('requests','input_tokens','output_tokens','total_tokens') then raise exception 'INVALID_ADMISSION'; end if;
    cap:=(b->>'limit')::bigint; amount:=(b->>'amount')::bigint;
    if cap<1 or amount<1 or cap>9007199254740991 or amount>9007199254740991 or (b->>'expiresAt')::timestamptz<=t then raise exception 'INVALID_ADMISSION'; end if;
    select * into existing from public.usage_reservations where operation_id=p_operation and bucket_hash=b->>'key' and metric=b->>'metric';
    if found then
      if existing.amount<>amount then raise exception 'RESERVATION_CONFLICT'; end if;
      continue;
    end if;
    select coalesce(sum(r.amount),0) into used from public.usage_reservations r where r.bucket_hash=b->>'key' and r.metric=b->>'metric' and r.expires_at>t;
    if used+amount>cap then
      needed:=used+amount-cap; released:=0;
      -- Earliest time sufficient reservations expire, rather than a fixed one-minute guess.
      for release_row in select r.expires_at,sum(r.amount) as amount from public.usage_reservations r
        where r.bucket_hash=b->>'key' and r.metric=b->>'metric' and r.expires_at>t group by r.expires_at order by r.expires_at loop
        released:=released+release_row.amount;
        if released>=needed then retry_at:=greatest(retry_at,release_row.expires_at); exit; end if;
      end loop;
      if released<needed then retry_at:=greatest(retry_at,(b->>'expiresAt')::timestamptz); end if;
    end if;
  end loop;
  if retry_at>t then return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from retry_at-t))::integer)); end if;
  for b in select value from jsonb_array_elements(p_buckets) order by value->>'key',value->>'metric' loop
    insert into public.usage_reservations(operation_id,bucket_hash,metric,amount,expires_at)
      values(p_operation,b->>'key',b->>'metric',(b->>'amount')::bigint,(b->>'expiresAt')::timestamptz)
      on conflict(operation_id,bucket_hash,metric) do nothing;
  end loop;
  return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;

create function public.cs_ai_begin_task(p_owner uuid,p_actor text,p_role text,p_key uuid,p_fingerprint text,p_policy text,p_seconds integer,p_buckets jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare task public.ai_tasks; active_until timestamptz; admitted jsonb; task_id uuid:=gen_random_uuid(); t timestamptz:=clock_timestamp();
begin
  perform pg_advisory_xact_lock(216220003);
  if p_seconds not between 1 and 30 then raise exception 'INVALID_ADMISSION'; end if;
  update public.ai_tasks set state='abandoned',finished_at=t where actor_hash=p_actor and state in ('reserved','running') and deadline<=t;
  select * into task from public.ai_tasks where actor_hash=p_actor and role=p_role and client_key=p_key;
  if found then
    if task.fingerprint<>p_fingerprint then return jsonb_build_object('code','AI_TASK_CONFLICT'); end if;
    return jsonb_build_object('code',case when task.state in ('reserved','running') then 'AI_TASK_IN_PROGRESS' else 'AI_TASK_FINISHED' end);
  end if;
  select max(deadline) into active_until from public.ai_tasks where actor_hash=p_actor and state in ('reserved','running');
  if active_until>t then return jsonb_build_object('code','AI_RATE_LIMITED','retryAfter',greatest(1,ceil(extract(epoch from active_until-t))::integer)); end if;
  admitted:=public.cs_reserve_usage(task_id,p_buckets);
  if not (admitted->>'allowed')::boolean then return admitted||jsonb_build_object('code','AI_RATE_LIMITED'); end if;
  insert into public.ai_tasks(id,owner_id,actor_hash,role,client_key,fingerprint,policy_digest,deadline)
    values(task_id,p_owner,p_actor,p_role,p_key,p_fingerprint,p_policy,t+make_interval(secs=>p_seconds));
  return jsonb_build_object('id',task_id,'deadline',t+make_interval(secs=>p_seconds));
end $$;

create function public.cs_ai_reserve_attempt(p_task uuid,p_provider text,p_model text,p_request uuid,p_prompt text,p_buckets jsonb,p_scopes text[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare task public.ai_tasks; n integer; run_id uuid:=gen_random_uuid(); admitted jsonb; s text; lease public.service_leases;
  retry_at timestamptz; t timestamptz:=clock_timestamp(); pool text; slot text; pool_keys text[];
begin
  perform pg_advisory_xact_lock(216220003);
  select * into task from public.ai_tasks where id=p_task for update;
  if not found or task.state not in ('reserved','running') or task.deadline<=t then return jsonb_build_object('code','AI_TASK_FINISHED'); end if;
  select count(*) into n from public.ai_runs where task_id=p_task;
  if n>=2 then return jsonb_build_object('code','AI_TASK_FINISHED'); end if;
  if exists(select 1 from public.ai_runs r join public.service_leases l on l.holder=r.id where r.task_id=p_task and r.state='running' and l.expires_at>t) then return jsonb_build_object('code','AI_TASK_IN_PROGRESS'); end if;
  if cardinality(p_scopes)<>2 then raise exception 'INVALID_ADMISSION'; end if;
  foreach s in array p_scopes loop
    select * into lease from public.service_leases where scope=s;
    if found then
      if lease.cooldown_until>t then retry_at:=greatest(retry_at,lease.cooldown_until);
      elsif lease.failures>=3 and lease.expires_at>t and lease.holder is not null then retry_at:=greatest(retry_at,lease.expires_at); end if;
    end if;
  end loop;
  pool_keys:=array[encode(sha256('carbonshift:provider-slot:0'::bytea),'hex'),encode(sha256('carbonshift:provider-slot:1'::bytea),'hex')];
  foreach pool in array pool_keys loop
    select * into lease from public.service_leases where scope=pool;
    if not found or lease.expires_at<=t or lease.holder is null then slot:=pool; exit; end if;
  end loop;
  if slot is null then
    select min(expires_at) into retry_at from public.service_leases where scope=any(pool_keys);
  end if;
  if retry_at is not null and retry_at>t then return jsonb_build_object('code','AI_RATE_LIMITED','retryAfter',greatest(1,ceil(extract(epoch from retry_at-t))::integer)); end if;
  admitted:=public.cs_reserve_usage(run_id,p_buckets);
  if not (admitted->>'allowed')::boolean then return admitted||jsonb_build_object('code','AI_RATE_LIMITED'); end if;
  -- Intent and leases commit before the caller can dispatch.
  insert into public.ai_runs(id,task_id,attempt,request_id,provider,model,prompt_version,policy_digest)
    values(run_id,p_task,n+1,p_request,p_provider,p_model,p_prompt,task.policy_digest);
  foreach s in array array_append(p_scopes,slot) loop
    insert into public.service_leases(scope,holder,expires_at,fencing) values(s,run_id,task.deadline,1)
      on conflict(scope) do update set holder=case when public.service_leases.failures>=3 or public.service_leases.scope=slot then run_id else public.service_leases.holder end,
        expires_at=case when public.service_leases.failures>=3 or public.service_leases.scope=slot then task.deadline else public.service_leases.expires_at end,
        fencing=public.service_leases.fencing+1;
  end loop;
  update public.ai_tasks set state='running' where id=p_task;
  return jsonb_build_object('id',run_id,'attempt',n+1);
end $$;

create function public.cs_ai_finish_attempt(p_run uuid,p_outcome text,p_latency integer,p_usage jsonb,p_scopes text[],p_retry integer) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_runs; s text; t timestamptz:=clock_timestamp(); l public.service_leases; metric_name text; actual bigint;
begin
  perform pg_advisory_xact_lock(216220003);
  select * into r from public.ai_runs where id=p_run for update;
  if not found or r.state<>'running' then return; end if;
  update public.ai_runs set state=p_outcome,latency_ms=p_latency,finished_at=t,
    input_tokens=(p_usage->>'input_tokens')::bigint,output_tokens=(p_usage->>'output_tokens')::bigint,total_tokens=(p_usage->>'total_tokens')::bigint where id=p_run;
  -- Unknown usage remains reserved. Usage can be higher than estimated; record it honestly.
  foreach metric_name in array array['input_tokens','output_tokens','total_tokens'] loop
    actual:=(p_usage->>metric_name)::bigint;
    if actual is not null and actual>=0 then update public.usage_reservations set amount=actual where operation_id=p_run and metric=metric_name; end if;
  end loop;
  update public.service_leases set holder=null,expires_at=t where holder=p_run;
  foreach s in array p_scopes loop
    select * into l from public.service_leases where scope=s for update;
    if not found then continue; end if;
    if p_outcome='succeeded' then
      -- A late older success must not close a newer failure's circuit.
      if l.failure_started_at is null or l.failure_started_at<=r.created_at then update public.service_leases set failures=0,failure_started_at=null,cooldown_until=null where scope=s; end if;
    elsif p_outcome in ('transient','rate_limited') then
      update public.service_leases set failures=case when failure_started_at is null or failure_started_at<t-interval '60 seconds' then 1 else failures+1 end,
        failure_started_at=case when failure_started_at is null or failure_started_at<t-interval '60 seconds' then t else failure_started_at end where scope=s returning * into l;
      if l.failures>=3 or p_outcome='rate_limited' then update public.service_leases set cooldown_until=greatest(cooldown_until,t+make_interval(secs=>greatest(60,least(coalesce(p_retry,60),172800)))) where scope=s; end if;
    end if;
  end loop;
end $$;

create function public.cs_ai_finish_task(p_task uuid,p_success boolean) returns void
language sql security definer set search_path=pg_catalog,public as $$
  update public.ai_tasks set state=case when p_success then 'succeeded' else 'failed' end,finished_at=clock_timestamp() where id=p_task and state in ('reserved','running');
$$;

create function public.cs_ai_prune() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform pg_advisory_xact_lock(216220003);
  update public.ai_tasks set state='abandoned',finished_at=clock_timestamp() where state in ('reserved','running') and deadline<=clock_timestamp();
  update public.ai_runs set state='unknown',finished_at=clock_timestamp() where state='running' and created_at<clock_timestamp()-interval '1 minute';
  delete from public.usage_reservations where expires_at<=clock_timestamp();
  delete from public.ai_explanation_cache where expires_at<=clock_timestamp();
  delete from public.ai_runs where created_at<clock_timestamp()-interval '7 days';
  delete from public.ai_tasks where created_at<clock_timestamp()-interval '7 days' and not exists(select 1 from public.ai_runs where task_id=public.ai_tasks.id);
  delete from public.service_leases where coalesce(expires_at,'epoch')<clock_timestamp()-interval '1 day' and coalesce(cooldown_until,'epoch')<clock_timestamp()-interval '1 day';
end $$;

alter table public.ai_tasks enable row level security;
alter table public.ai_runs enable row level security;
alter table public.usage_reservations enable row level security;
alter table public.service_leases enable row level security;
alter table public.ai_explanation_cache enable row level security;
revoke all on public.ai_tasks,public.ai_runs,public.usage_reservations,public.service_leases,public.ai_explanation_cache from public,anon,authenticated;
grant all on public.ai_tasks,public.ai_runs,public.usage_reservations,public.service_leases,public.ai_explanation_cache to service_role;
grant usage,select on sequence public.usage_reservations_id_seq to service_role;
revoke all on function public.cs_reserve_usage(uuid,jsonb),public.cs_ai_begin_task(uuid,text,text,uuid,text,text,integer,jsonb),public.cs_ai_reserve_attempt(uuid,text,text,uuid,text,jsonb,text[]),public.cs_ai_finish_attempt(uuid,text,integer,jsonb,text[],integer),public.cs_ai_finish_task(uuid,boolean),public.cs_ai_prune() from public,anon,authenticated;
grant execute on function public.cs_reserve_usage(uuid,jsonb),public.cs_ai_begin_task(uuid,text,text,uuid,text,text,integer,jsonb),public.cs_ai_reserve_attempt(uuid,text,text,uuid,text,jsonb,text[]),public.cs_ai_finish_attempt(uuid,text,integer,jsonb,text[],integer),public.cs_ai_finish_task(uuid,boolean),public.cs_ai_prune() to service_role;
