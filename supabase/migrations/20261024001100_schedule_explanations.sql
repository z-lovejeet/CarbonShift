create table public.schedule_explanation_cache (
  schedule_id uuid not null, owner_id uuid not null, cache_key text not null check(cache_key ~ '^[0-9a-f]{64}$'),
  selection jsonb not null check(selection->>'schemaVersion'='2'), expires_at timestamptz not null,
  primary key(schedule_id,cache_key), foreign key(schedule_id,owner_id) references public.schedules(id,owner_id) on delete cascade
);
alter table public.schedule_explanation_cache enable row level security;
revoke all on public.schedule_explanation_cache from public,anon,authenticated;
grant select on public.schedule_explanation_cache to authenticated;
grant all on public.schedule_explanation_cache to service_role;
create policy schedule_explanation_owner on public.schedule_explanation_cache for select to authenticated using(owner_id=(select auth.uid()));
