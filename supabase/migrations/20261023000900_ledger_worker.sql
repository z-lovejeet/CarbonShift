-- One fenced lease per chain/signer, independent of web process lifetimes.
create function public.cs_ledger_lease(p_scope text,p_holder uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare token bigint;
begin
  if p_scope !~ '^11155111:0x[0-9a-f]{40}$' then raise exception using message='INVALID_INPUT'; end if;
  insert into public.ledger_worker_leases(scope,holder,expires_at) values(p_scope,p_holder,clock_timestamp()+interval '2 minutes')
  on conflict(scope) do update set holder=excluded.holder,
    fence=case when ledger_worker_leases.holder=excluded.holder then ledger_worker_leases.fence else ledger_worker_leases.fence+1 end,
    expires_at=excluded.expires_at
  where ledger_worker_leases.holder=excluded.holder or ledger_worker_leases.expires_at<=clock_timestamp()
  returning fence into token;
  return token;
end; $$;
create function public.cs_ledger_assert_lease(p_scope text,p_holder uuid,p_fence bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.ledger_worker_leases where scope=p_scope and holder=p_holder and fence=p_fence and expires_at>clock_timestamp() for update;
  if not found then raise exception using message='LEASE_LOST'; end if;
end; $$;
create function public.cs_ledger_prepare(p_operation uuid,p_scope text,p_holder uuid,p_fence bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare op public.ledger_operations; pub public.publications; p public.plans;
begin
  perform public.cs_ledger_assert_lease(p_scope,p_holder,p_fence);
  select * into op from public.ledger_operations where id=p_operation;
  select * into pub from public.publications where id=op.publication_id;
  if pub.plan_id is not null then select * into p from public.plans where id=pub.plan_id for update; end if;
  select * into op from public.ledger_operations where id=p_operation for update;
  if op.id is null or op.status not in ('queued','signing') or exists(select 1 from public.ledger_signed_transactions where operation_id=op.id) then return false; end if;
  if pub.owner_id is null or (op.kind='plan' and (p.status is distinct from 'accepted' or (pub.manifest->>'commitBeforeUtc')::timestamptz<clock_timestamp()+interval '10 minutes')) then
    update public.ledger_operations set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp() where id=op.id;
    return false;
  end if;
  if exists(select 1 from public.ledger_operations o where o.id<>op.id and o.status in ('signing','submitted','uncertain')) then return false; end if;
  if op.kind='result' and exists(select 1 from public.ledger_operations o left join public.published_results r on r.id=o.result_id
    where o.publication_id=pub.id and o.id<>op.id and (o.kind='plan' or r.public_sequence<(select public_sequence from public.published_results where id=op.result_id)) and o.status<>'confirmed') then return false; end if;
  update public.ledger_operations set status='signing',attempts=attempts+1,failure_code=null,updated_at=clock_timestamp() where id=op.id;
  return true;
end; $$;
create function public.cs_ledger_persist_signed(p_operation uuid,p_scope text,p_holder uuid,p_fence bigint,p_nonce bigint,p_raw text,p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare op public.ledger_operations; pub public.publications; p public.plans;
begin
  perform public.cs_ledger_assert_lease(p_scope,p_holder,p_fence);
  select * into op from public.ledger_operations where id=p_operation;
  select * into pub from public.publications where id=op.publication_id;
  if pub.plan_id is not null then select * into p from public.plans where id=pub.plan_id for update; end if;
  select * into op from public.ledger_operations where id=p_operation for update;
  if op.status<>'signing' or exists(select 1 from public.ledger_signed_transactions where operation_id=op.id) then return false; end if;
  -- Cancellation/deletion and durable signing share this plan lock.
  if pub.owner_id is null or (op.kind='plan' and (p.status is distinct from 'accepted' or (pub.manifest->>'commitBeforeUtc')::timestamptz<clock_timestamp()+interval '10 minutes')) then
    update public.ledger_operations set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp() where id=op.id; return false;
  end if;
  insert into public.ledger_signed_transactions(operation_id,signer,chain_id,nonce,raw_transaction,transaction_hash)
    values(op.id,split_part(p_scope,':',2),11155111,p_nonce,p_raw,p_hash);
  update public.ledger_operations set status='submitted',transaction_hash=p_hash,updated_at=clock_timestamp() where id=op.id;
  return true;
end; $$;
create function public.cs_ledger_observe(p_operation uuid,p_scope text,p_holder uuid,p_fence bigint,p_status text,p_code text,p_block bigint,p_block_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.cs_ledger_assert_lease(p_scope,p_holder,p_fence);
  if p_status not in ('submitted','uncertain','confirmed','failed') or p_code is not null and p_code not in ('RPC_UNAVAILABLE','NOT_FOUND','REORGANIZED','REVERTED','CHAIN_MISMATCH','NONCE_CONFLICT','EVENT_MISMATCH','INVALID_MANIFEST') then raise exception using message='INVALID_INPUT'; end if;
  if p_status='confirmed' and (p_block is null or p_block_hash is null) then raise exception using message='INVALID_INPUT'; end if;
  update public.ledger_operations set status=p_status,failure_code=p_code,block_number=p_block,block_hash=p_block_hash,checked_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=p_operation and (status<>'failed' or exists(select 1 from public.ledger_signed_transactions s where s.operation_id=p_operation));
end; $$;
create function public.cs_ledger_release(p_scope text,p_holder uuid,p_fence bigint) returns void language sql security definer set search_path='' as $$
  update public.ledger_worker_leases set expires_at=clock_timestamp() where scope=p_scope and holder=p_holder and fence=p_fence;
$$;

create function public.cs_publication_cancel() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    update public.ledger_operations o set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp()
      from public.publications p where p.plan_id=new.id and o.publication_id=p.id and o.kind='plan' and o.status in ('queued','signing')
      and not exists(select 1 from public.ledger_signed_transactions s where s.operation_id=o.id);
  end if;
  return new;
end; $$;
create trigger publication_cancel after update on public.plans for each row execute function public.cs_publication_cancel();
create function public.cs_publication_delete_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.publications where plan_id=old.id) then raise exception using message='PUBLISHED_PLAN_RETAINED'; end if;
  return old;
end; $$;
create trigger publication_delete_guard before delete on public.plans for each row execute function public.cs_publication_delete_guard();
create or replace function public.cs_private_account_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
  perform 1 from public.plans where owner_id=old.id order by id for update;
  update public.ledger_operations o set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp()
    from public.publications p where p.owner_id=old.id and p.id=o.publication_id and o.status in ('queued','signing')
    and not exists(select 1 from public.ledger_signed_transactions s where s.operation_id=o.id);
  -- Already signed operations retain public content and reconcile independently of the account.
  update public.publications set plan_id=null,owner_id=null where owner_id=old.id;
  select array_agg(id) into ids from (select snapshot_id id from public.comparisons where owner_id=old.id union select actual_snapshot_id from public.result_revisions where owner_id=old.id and actual_snapshot_id is not null) snapshots;
  delete from public.plans where owner_id=old.id;
  delete from public.comparisons where owner_id=old.id;
  perform public.cs_prune_private_snapshots(ids);
  return old;
end; $$;

-- Owner projections include real publication state without exposing outbox/signing internals.
create or replace function public.cs_read_private_plan(p_plan uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('plan',to_jsonb(p),'forecastSnapshot',s.snapshot,'forecastHash',s.digest,
    'publicationStatus',coalesce((select o.status from public.publications pub join public.ledger_operations o on o.publication_id=pub.id and o.kind='plan' where pub.plan_id=p.id),'private'),
    'reports',coalesce((select jsonb_agg(r.document order by r.sequence) from public.completion_reports r where r.plan_id=p.id),'[]'::jsonb),
    'revisions',coalesce((select jsonb_agg(r.document order by r.sequence) from public.result_revisions r where r.plan_id=p.id),'[]'::jsonb))
  from public.plans p join public.grid_snapshots s on s.id=(p.accepted_payload->>'forecastSnapshotId')::uuid where p.id=p_plan and p.owner_id=(select auth.uid());
$$;
create or replace function public.cs_read_private_plan_page(p_limit integer,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(item order by accepted_at desc,id desc),'[]'::jsonb) from (
    select p.id,p.accepted_at,to_jsonb(p)||jsonb_build_object('completion',coalesce((select r.kind from public.completion_reports r where r.plan_id=p.id order by r.sequence desc limit 1),'not_reported'),
      'publicationStatus',coalesce((select o.status from public.publications pub join public.ledger_operations o on o.publication_id=pub.id and o.kind='plan' where pub.plan_id=p.id),'private')) item
    from public.plans p where p.owner_id=(select auth.uid()) and (p_before_time is null or (p.accepted_at,p.id)<(p_before_time,p_before_id))
    order by p.accepted_at desc,p.id desc limit greatest(1,least(20,p_limit))+1
  ) page;
$$;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'cs_ledger_%' or proname in ('cs_publication_cancel','cs_publication_delete_guard')) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
