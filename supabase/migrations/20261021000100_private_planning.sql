-- M04: private planning only. Publication and completion are separate migrations.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.grid_snapshots (
  id uuid primary key,
  payload_text text not null check (octet_length(payload_text) <= 262144),
  snapshot jsonb generated always as (payload_text::jsonb) stored,
  digest text not null check (digest ~ '^0x[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload_text::jsonb) = 'object'),
  check ((payload_text::jsonb)->>'geography' = 'GB_NATIONAL'),
  check (((payload_text::jsonb)->>'retrievedAtUtc')::timestamptz = retrieved_at),
  check (digest = '0x' || encode(extensions.digest('CarbonShift:grid-snapshot:v1' || chr(10) || payload_text, 'sha256'), 'hex')),
  unique (id, digest)
);
create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  snapshot_hash text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version integer not null default 1 check (version = 1),
  expires_at timestamptz not null,
  created_at timestamptz not null,
  unique (id, owner_id),
  foreign key (snapshot_id, snapshot_hash) references public.grid_snapshots(id, digest),
  check ((payload->>'forecastSnapshotId')::uuid = snapshot_id),
  check (payload->>'forecastSnapshotHash' = snapshot_hash),
  check ((payload->>'createdAtUtc')::timestamptz = created_at),
  check ((payload->>'expiresAtUtc')::timestamptz = expires_at),
  check (expires_at > created_at and expires_at <= created_at + interval '5 minutes'),
  check (payload->>'methodVersion' = 'carbonshift-gb-uniform-v1')
);
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  comparison_id uuid not null unique,
  mode text not null default 'live' check (mode = 'live'),
  status text not null default 'accepted' check (status in ('accepted','cancelled')),
  accepted_payload jsonb not null check (jsonb_typeof(accepted_payload) = 'object'),
  accepted_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  foreign key (comparison_id, owner_id) references public.comparisons(id, owner_id)
);
create index plans_owner_page on public.plans(owner_id, accepted_at desc, id desc);
create index comparisons_owner on public.comparisons(owner_id);
create table public.mutation_keys (
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  key text not null check (length(key) between 8 and 128),
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  response_reference uuid not null references public.plans(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (owner_id, scope, key),
  check (expires_at > created_at)
);
create table public.usage_buckets (
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  bucket_type text not null,
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (subject_hash,bucket_type,window_start)
);

alter table public.profiles enable row level security;
alter table public.grid_snapshots enable row level security;
alter table public.comparisons enable row level security;
alter table public.plans enable row level security;
alter table public.mutation_keys enable row level security;
alter table public.usage_buckets enable row level security;
revoke all on public.profiles, public.grid_snapshots, public.comparisons, public.plans, public.mutation_keys, public.usage_buckets from public, anon, authenticated;
grant select on public.profiles, public.grid_snapshots, public.comparisons, public.plans to authenticated;
grant all on public.profiles, public.grid_snapshots, public.comparisons, public.plans, public.mutation_keys, public.usage_buckets to service_role;
create policy profiles_owner on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy comparisons_owner on public.comparisons for select to authenticated using ((select auth.uid()) = owner_id);
create policy plans_owner on public.plans for select to authenticated using ((select auth.uid()) = owner_id);
create policy snapshots_owner on public.grid_snapshots for select to authenticated using (
  exists (select 1 from public.comparisons c where c.snapshot_id = grid_snapshots.id and c.owner_id = (select auth.uid()))
);

create function public.cs_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception using errcode = 'P0001', message = 'IMMUTABLE_RECORD'; end;
$$;
create trigger snapshots_immutable before update on public.grid_snapshots for each row execute function public.cs_immutable();
create trigger comparisons_immutable before update on public.comparisons for each row execute function public.cs_immutable();
create trigger plans_immutable before update on public.plans for each row execute function public.cs_immutable();
revoke all on function public.cs_immutable() from public, anon, authenticated;

create function public.cs_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(user_id) values (new.id) on conflict do nothing; return new; end;
$$;
revoke all on function public.cs_profile_for_user() from public, anon, authenticated;
create trigger carbonshift_new_user after insert on auth.users for each row execute function public.cs_profile_for_user();
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;

create function public.cs_comparison_quota(p_subject text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer; window_utc timestamptz := date_trunc('minute',clock_timestamp());
begin
  insert into public.usage_buckets(subject_hash,bucket_type,window_start,count)
    values (p_subject,'comparison_minute',window_utc,1)
    on conflict (subject_hash,bucket_type,window_start) do update set count = public.usage_buckets.count + 1
    returning count into n;
  return n <= 10;
end;
$$;
revoke all on function public.cs_comparison_quota(text) from public, anon, authenticated;
grant execute on function public.cs_comparison_quota(text) to service_role;

create function public.cs_create_comparison(p_owner uuid, p_id uuid, p_snapshot_id uuid, p_snapshot_text text, p_snapshot_hash text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.grid_snapshots; stamp timestamptz := clock_timestamp();
begin
  if (p_payload->>'createdAtUtc')::timestamptz > stamp
    or (p_payload->>'expiresAtUtc')::timestamptz <= stamp
    or (p_snapshot_text::jsonb->>'retrievedAtUtc')::timestamptz > stamp
    or (p_snapshot_text::jsonb->>'retrievedAtUtc')::timestamptz < stamp - interval '30 minutes' then
    raise exception using errcode='P0001', message='COMPARISON_EXPIRED';
  end if;
  insert into public.grid_snapshots(id,payload_text,digest,retrieved_at)
    values (p_snapshot_id,p_snapshot_text,p_snapshot_hash,(p_snapshot_text::jsonb->>'retrievedAtUtc')::timestamptz)
    on conflict (id) do nothing;
  select * into strict existing from public.grid_snapshots where id=p_snapshot_id;
  if existing.payload_text <> p_snapshot_text or existing.digest <> p_snapshot_hash then
    raise exception using errcode='P0001', message='SNAPSHOT_CONFLICT';
  end if;
  insert into public.comparisons(id,owner_id,snapshot_id,snapshot_hash,payload,expires_at,created_at)
    values (p_id,p_owner,p_snapshot_id,p_snapshot_hash,p_payload,(p_payload->>'expiresAtUtc')::timestamptz,(p_payload->>'createdAtUtc')::timestamptz);
  return p_id;
end;
$$;
revoke all on function public.cs_create_comparison(uuid,uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.cs_create_comparison(uuid,uuid,uuid,text,text,jsonb) to service_role;

create function public.cs_accept_plan(p_owner uuid, p_comparison uuid, p_version integer, p_key text, p_request_digest text)
returns public.plans language plpgsql security definer set search_path = '' as $$
declare
  proposal public.comparisons; frozen public.grid_snapshots; accepted public.plans;
  mutation public.mutation_keys; stamp timestamptz;
begin
  if p_key is null or length(p_key) not between 8 and 128 or p_key !~ '^[A-Za-z0-9_-]+$'
    or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='P0001', message='INVALID_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text || ':plans.accept:' || p_key,0));
  stamp := clock_timestamp();
  select * into mutation from public.mutation_keys where owner_id=p_owner and scope='plans.accept' and key=p_key;
  if found and mutation.expires_at > stamp then
    if mutation.request_digest <> p_request_digest then
      raise exception using errcode='P0001', message='IDEMPOTENCY_CONFLICT';
    end if;
    select * into strict accepted from public.plans where id=mutation.response_reference and owner_id=p_owner;
    return accepted;
  end if;
  delete from public.mutation_keys where owner_id=p_owner and scope='plans.accept' and key=p_key;
  select * into proposal from public.comparisons where id=p_comparison and owner_id=p_owner for update;
  if not found then raise exception using errcode='P0001', message='NOT_FOUND'; end if;
  if proposal.version <> p_version then raise exception using errcode='P0001', message='VERSION_CONFLICT'; end if;
  select * into accepted from public.plans where comparison_id=proposal.id and owner_id=p_owner;
  if not found then
    stamp := clock_timestamp();
    select * into strict frozen from public.grid_snapshots where id=proposal.snapshot_id and digest=proposal.snapshot_hash;
    if stamp < proposal.created_at or stamp >= proposal.expires_at
      or least((proposal.payload->'baseline'->>'startUtc')::timestamptz,(proposal.payload->'selected'->>'startUtc')::timestamptz) < stamp + interval '10 minutes'
      or frozen.retrieved_at > stamp or frozen.retrieved_at < stamp - interval '30 minutes' then
      raise exception using errcode='P0001', message='COMPARISON_EXPIRED';
    end if;
    insert into public.plans(owner_id,comparison_id,accepted_payload,accepted_at)
      values(p_owner,proposal.id,proposal.payload,date_trunc('second',stamp)) returning * into accepted;
  end if;
  insert into public.mutation_keys(owner_id,scope,key,request_digest,response_reference)
    values (p_owner,'plans.accept',p_key,p_request_digest,accepted.id);
  return accepted;
end;
$$;
revoke all on function public.cs_accept_plan(uuid,uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.cs_accept_plan(uuid,uuid,integer,text,text) to service_role;
