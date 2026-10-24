-- Additive v2 household schedules. Existing v1 payloads and hashes are untouched.
create table public.activity_profile_versions (
  id text not null, version integer not null check(version > 0), payload jsonb not null,
  primary key(id,version), check(payload->>'id'=id and (payload->>'version')::integer=version)
);
create table public.schedule_comparisons (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null, created_at timestamptz not null, expires_at timestamptz not null,
  unique(id,owner_id), check(octet_length(payload::text)<=524288),
  check(payload ?& array['schemaVersion','id','input','activities','grid','solution','createdAtUtc','expiresAtUtc']),
  check(payload->>'schemaVersion'='2' and payload->>'methodVersion'='carbonshift-gb-activities-v2'),
  check((payload->>'id')::uuid=id), check((payload->>'createdAtUtc')::timestamptz=created_at),
  check((payload->>'expiresAtUtc')::timestamptz=expires_at),
  check(expires_at > created_at and expires_at <= created_at + interval '5 minutes'),
  check(jsonb_array_length(payload#>'{input,tasks}') between 1 and 12)
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null unique, accepted_payload jsonb not null,
  option_index integer not null check(option_index between 0 and 3),
  accepted_at timestamptz not null default date_trunc('second',now()),
  unique(id,owner_id), foreign key(comparison_id,owner_id) references public.schedule_comparisons(id,owner_id)
);
create table public.schedule_tasks (
  schedule_id uuid not null, owner_id uuid not null, task_id text not null, payload jsonb not null,
  primary key(schedule_id,task_id), foreign key(schedule_id,owner_id) references public.schedules(id,owner_id) on delete cascade,
  check(payload#>>'{input,activity,id}'=task_id)
);
create table public.schedule_mutation_keys (
  owner_id uuid not null references auth.users(id) on delete cascade, scope text not null,
  key uuid not null, request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),
  response_reference uuid not null references public.schedules(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(owner_id,scope,key)
);
create index schedules_owner_page on public.schedules(owner_id,accepted_at desc,id desc);
create index schedule_comparisons_owner on public.schedule_comparisons(owner_id);
alter table public.activity_profile_versions enable row level security;
alter table public.schedule_comparisons enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_tasks enable row level security;
alter table public.schedule_mutation_keys enable row level security;
revoke all on public.activity_profile_versions,public.schedule_comparisons,public.schedules,public.schedule_tasks,public.schedule_mutation_keys from public,anon,authenticated;
grant select on public.activity_profile_versions,public.schedule_comparisons,public.schedules,public.schedule_tasks to authenticated;
grant all on public.activity_profile_versions,public.schedule_comparisons,public.schedules,public.schedule_tasks,public.schedule_mutation_keys to service_role;
create policy activity_profiles_read on public.activity_profile_versions for select to authenticated using(true);
create policy schedule_comparisons_owner on public.schedule_comparisons for select to authenticated using(owner_id=(select auth.uid()));
create policy schedules_owner on public.schedules for select to authenticated using(owner_id=(select auth.uid()));
create policy schedule_tasks_owner on public.schedule_tasks for select to authenticated using(owner_id=(select auth.uid()));
create trigger activity_profiles_immutable before update on public.activity_profile_versions for each row execute function public.cs_immutable();
create trigger schedule_comparisons_immutable before update on public.schedule_comparisons for each row execute function public.cs_immutable();
create trigger schedules_immutable before update on public.schedules for each row execute function public.cs_immutable();
create trigger schedule_tasks_immutable before update on public.schedule_tasks for each row execute function public.cs_immutable();

create function public.cs_guard_schedule_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare proposal public.schedule_comparisons;
begin
  select * into proposal from public.schedule_comparisons where id=new.comparison_id and owner_id=new.owner_id;
  if not found then raise exception using errcode='23503',message='COMPARISON_OWNER_MISMATCH'; end if;
  if new.accepted_payload is distinct from proposal.payload then raise exception using errcode='23514',message='ACCEPTED_PAYLOAD_MISMATCH'; end if;
  if new.option_index > jsonb_array_length(proposal.payload#>'{solution,alternatives}') then raise exception using errcode='23514',message='INVALID_OPTION'; end if;
  return new;
end; $$;
revoke all on function public.cs_guard_schedule_insert() from public,anon,authenticated;
create trigger schedule_insert_guard before insert on public.schedules for each row execute function public.cs_guard_schedule_insert();

create function public.cs_create_schedule_comparison(p_owner uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=clock_timestamp(); identity uuid:=(p_payload->>'id')::uuid; retrieved timestamptz:=(p_payload#>>'{grid,snapshot,retrievedAtUtc}')::timestamptz;
begin
  if retrieved is null or retrieved > stamp or retrieved < stamp-interval '30 minutes' or (p_payload->>'expiresAtUtc')::timestamptz <= stamp or (p_payload->>'createdAtUtc')::timestamptz > stamp then raise exception using errcode='P0001',message='COMPARISON_EXPIRED'; end if;
  insert into public.schedule_comparisons(id,owner_id,payload,created_at,expires_at) values(identity,p_owner,p_payload,(p_payload->>'createdAtUtc')::timestamptz,(p_payload->>'expiresAtUtc')::timestamptz);
  return identity;
end; $$;
revoke all on function public.cs_create_schedule_comparison(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cs_create_schedule_comparison(uuid,jsonb) to service_role;

create function public.cs_accept_schedule(p_owner uuid,p_comparison uuid,p_option integer,p_key uuid,p_digest text) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.schedule_mutation_keys; proposal public.schedule_comparisons; saved public.schedules; selected jsonb; task jsonb; stamp timestamptz:=clock_timestamp(); cutoff timestamptz; retrieved timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':schedule:'||p_key::text,0));
  select * into prior from public.schedule_mutation_keys where owner_id=p_owner and scope='accept' and key=p_key;
  if found then
    if prior.request_digest<>p_digest then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return prior.response_reference;
  end if;
  select * into proposal from public.schedule_comparisons where id=p_comparison and owner_id=p_owner for update;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into saved from public.schedules where comparison_id=p_comparison;
  if found then
    if saved.option_index<>p_option then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  else
    if p_option is null or p_option<0 or p_option>jsonb_array_length(proposal.payload#>'{solution,alternatives}') then raise exception using errcode='P0001',message='INVALID_OPTION'; end if;
    selected:=case when p_option=0 then proposal.payload#>'{solution,selected}' else proposal.payload#>'{solution,alternatives}'->(p_option-1) end;
    select min((v->>'startUtc')::timestamptz) into cutoff from jsonb_array_elements((proposal.payload#>'{solution,baseline,tasks}') || (selected->'tasks')) v;
    retrieved:=(proposal.payload#>>'{grid,snapshot,retrievedAtUtc}')::timestamptz;
    if proposal.expires_at<=stamp or cutoff-interval '10 minutes'<=stamp or retrieved<stamp-interval '30 minutes' or retrieved>stamp then raise exception using errcode='P0001',message='COMPARISON_EXPIRED'; end if;
    insert into public.schedules(owner_id,comparison_id,accepted_payload,option_index) values(p_owner,p_comparison,proposal.payload,p_option) returning * into saved;
    for task in select value from jsonb_array_elements(proposal.payload#>'{input,tasks}') loop
      insert into public.schedule_tasks(schedule_id,owner_id,task_id,payload) values(saved.id,p_owner,task#>>'{activity,id}',jsonb_build_object('input',task));
    end loop;
  end if;
  insert into public.schedule_mutation_keys(owner_id,scope,key,request_digest,response_reference) values(p_owner,'accept',p_key,p_digest,saved.id);
  return saved.id;
end; $$;
revoke all on function public.cs_accept_schedule(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.cs_accept_schedule(uuid,uuid,integer,uuid,text) to service_role;
