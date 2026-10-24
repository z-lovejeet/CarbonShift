-- Share the existing fenced ledger outbox, retaining v1 manifests unchanged.
alter table public.publications add column schedule_id uuid unique references public.schedules(id) on delete set null;
alter table public.publications add constraint publication_one_private_source check(num_nonnulls(plan_id,schedule_id)<=1);
alter table public.published_results add column private_vector_digest text;
create unique index unique_public_task_vector on public.published_results(publication_id,private_vector_digest) where private_vector_digest is not null;
do $$ declare item record; begin
  for item in select conrelid::regclass relation,conname from pg_constraint where conrelid in ('public.publications'::regclass,'public.published_results'::regclass) and contype='c' and (pg_get_constraintdef(oid) like '%CarbonShift:%:v1%' or pg_get_constraintdef(oid) like '%public-proof-v1%') loop
    execute format('alter table %s drop constraint %I',item.relation,item.conname);
  end loop;
end $$;
alter table public.publications add constraint publication_versioned_hash check(
  manifest->>'schemaVersion' in ('1','2') and consent_version='public-proof-v'||(manifest->>'schemaVersion') and
  manifest_hash='0x'||encode(extensions.digest('CarbonShift:plan:v'||(manifest->>'schemaVersion')||chr(10)||canonical_text,'sha256'),'hex') and octet_length(canonical_text)<=1048576);
alter table public.published_results add constraint result_versioned_hash check(
  manifest->>'schemaVersion' in ('1','2') and consent_version='public-proof-v'||(manifest->>'schemaVersion') and
  manifest_hash='0x'||encode(extensions.digest('CarbonShift:result:v'||(manifest->>'schemaVersion')||chr(10)||canonical_text,'sha256'),'hex') and octet_length(canonical_text)<=1048576);
create or replace function public.cs_guard_public_copy() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using message='IMMUTABLE_RECORD'; end if;
  if tg_table_name='publications' then
    if (to_jsonb(new)-'owner_id'-'plan_id'-'schedule_id') is distinct from (to_jsonb(old)-'owner_id'-'plan_id'-'schedule_id') or
      (new.owner_id is distinct from old.owner_id and new.owner_id is not null) or (new.plan_id is distinct from old.plan_id and new.plan_id is not null) or (new.schedule_id is distinct from old.schedule_id and new.schedule_id is not null) then raise exception using message='IMMUTABLE_RECORD'; end if;
  else
    if (to_jsonb(new)-'result_revision_id') is distinct from (to_jsonb(old)-'result_revision_id') or (new.result_revision_id is distinct from old.result_revision_id and new.result_revision_id is not null) then raise exception using message='IMMUTABLE_RECORD'; end if;
  end if;
  return new;
end; $$;
create table public.schedule_receipt_identities (
  schedule_id uuid primary key references public.schedules(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete cascade,
  receipt_id text not null unique check(receipt_id ~ '^0x[0-9a-f]{64}$'), nonce text not null check(nonce ~ '^0x[0-9a-f]{64}$'), contract_address text not null check(contract_address ~ '^0x[0-9a-f]{40}$')
);
create table public.schedule_publication_previews (
  id uuid primary key default gen_random_uuid(), schedule_id uuid not null references public.schedules(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, kind text not null check(kind in ('plan','result')), private_vector jsonb,
  manifest jsonb not null, canonical_text text not null check(octet_length(canonical_text)<=1048576), manifest_hash text not null,
  consent_version text not null default 'public-proof-v2' check(consent_version='public-proof-v2'),
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  check(expires_at>created_at and manifest=canonical_text::jsonb and manifest->>'schemaVersion'='2' and manifest->>'type'=kind),
  check(manifest_hash='0x'||encode(extensions.digest('CarbonShift:'||kind||':v2'||chr(10)||canonical_text,'sha256'),'hex'))
);
alter table public.schedule_receipt_identities enable row level security;
alter table public.schedule_publication_previews enable row level security;
revoke all on public.schedule_receipt_identities,public.schedule_publication_previews from public,anon,authenticated;
grant all on public.schedule_receipt_identities,public.schedule_publication_previews to service_role;
create trigger schedule_identity_immutable before update on public.schedule_receipt_identities for each row execute function public.cs_immutable();
create trigger schedule_preview_immutable before update on public.schedule_publication_previews for each row execute function public.cs_immutable();
create function public.cs_schedule_vector(p_schedule uuid) returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('taskId',t.task_id,'reportSequence',coalesce((select max(r.sequence) from public.schedule_reports r where r.schedule_id=t.schedule_id and r.task_id=t.task_id),0),'resultSequence',coalesce((select max(r.sequence) from public.schedule_results r where r.schedule_id=t.schedule_id and r.task_id=t.task_id),0)) order by t.task_id),'[]'::jsonb) from public.schedule_tasks t where t.schedule_id=p_schedule;
$$;
create function public.cs_schedule_receipt_identity(p_owner uuid,p_schedule uuid,p_receipt text,p_nonce text,p_contract text) returns jsonb language plpgsql security definer set search_path='' as $$
declare identity public.schedule_receipt_identities;
begin
  perform 1 from public.schedules where id=p_schedule and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  if exists(select 1 from public.publication_identities where receipt_id=p_receipt) then raise exception using message='PREVIEW_CHANGED'; end if;
  insert into public.schedule_receipt_identities values(p_schedule,p_owner,p_receipt,p_nonce,p_contract) on conflict(schedule_id) do nothing;
  select * into strict identity from public.schedule_receipt_identities where schedule_id=p_schedule and owner_id=p_owner;
  if identity.contract_address<>p_contract then raise exception using message='PREVIEW_CHANGED'; end if;
  return jsonb_build_object('receiptId',identity.receipt_id,'nonce',identity.nonce,'contractAddress',identity.contract_address);
end; $$;
create function public.cs_schedule_publication_preview(p_owner uuid,p_schedule uuid,p_text text,p_hash text,p_vector jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.schedules; pub public.publications; prior public.published_results; draft public.schedule_publication_previews; m jsonb:=p_text::jsonb; cutoff timestamptz; expiry timestamptz:=clock_timestamp()+interval '5 minutes'; chosen jsonb;
begin
  select * into saved from public.schedules where id=p_schedule and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  select * into pub from public.publications where schedule_id=p_schedule;
  if m->>'type'='plan' then
    chosen:=case when saved.option_index=0 then saved.accepted_payload#>'{solution,selected}' else saved.accepted_payload#>'{solution,alternatives}'->(saved.option_index-1) end;
    select min((t->>'startUtc')::timestamptz) into cutoff from jsonb_array_elements((saved.accepted_payload#>'{solution,baseline,tasks}')||(chosen->'tasks')) t;
    expiry:=least(expiry,cutoff-interval '10 minutes');
    if pub.id is not null or expiry<=clock_timestamp() then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    if p_vector is not null or (m->>'commitBeforeUtc')::timestamptz<>cutoff or not exists(select 1 from public.schedule_receipt_identities i where i.schedule_id=p_schedule and i.receipt_id=m->>'receiptId' and i.nonce=m->>'nonce' and i.contract_address=m->>'contractAddress') then raise exception using message='PREVIEW_CHANGED'; end if;
  elsif m->>'type'='result' then
    if p_vector is distinct from public.cs_schedule_vector(p_schedule) then raise exception using message='PREVIEW_CHANGED'; end if;
    if pub.id is null or exists(select 1 from public.ledger_operations where publication_id=pub.id and status<>'confirmed') then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    select * into prior from public.published_results where publication_id=pub.id order by public_sequence desc limit 1;
    if (m->>'publicRevision')::integer<>coalesce(prior.public_sequence,0)+1 or m->>'previousResultHash'<>coalesce(prior.manifest_hash,'0x'||repeat('0',64)) or m->>'planHash'<>pub.manifest_hash or m->>'receiptId'<>pub.receipt_id then raise exception using message='PREVIEW_CHANGED'; end if;
    if exists(select 1 from public.published_results where publication_id=pub.id and private_vector_digest=encode(extensions.digest(p_vector::text,'sha256'),'hex')) then raise exception using message='PREVIEW_CHANGED'; end if;
  else raise exception using message='INVALID_INPUT'; end if;
  select * into draft from public.schedule_publication_previews where schedule_id=p_schedule and kind=m->>'type' and (manifest-'nonce')=(m-'nonce') and private_vector is not distinct from p_vector and expires_at>clock_timestamp() order by created_at desc limit 1;
  if draft.id is null then insert into public.schedule_publication_previews(schedule_id,owner_id,kind,private_vector,manifest,canonical_text,manifest_hash,expires_at) values(p_schedule,p_owner,m->>'type',p_vector,m,p_text,p_hash,expiry) returning * into draft; end if;
  return to_jsonb(draft);
end; $$;
create function public.cs_schedule_publication_consent(p_owner uuid,p_schedule uuid,p_preview uuid,p_hash text,p_key text,p_digest text) returns jsonb language plpgsql security definer set search_path='' as $$
declare preview public.schedule_publication_previews; pub public.publications; prior public.published_results; item public.published_results; op public.ledger_operations; saved public.lifecycle_mutations; ack jsonb; command_scope text:='schedule-publication:'||p_schedule::text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||command_scope||':'||p_key,0));
  select * into saved from public.lifecycle_mutations where owner_id=p_owner and scope=command_scope and key=p_key and expires_at>clock_timestamp();
  if found then if saved.request_digest<>p_digest then raise exception using message='IDEMPOTENCY_CONFLICT'; end if; return saved.response; end if;
  perform 1 from auth.users where id=p_owner for update;
  perform 1 from public.schedules where id=p_schedule and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  select * into preview from public.schedule_publication_previews where id=p_preview and owner_id=p_owner and schedule_id=p_schedule;
  if not found or preview.manifest_hash<>p_hash or preview.expires_at<=clock_timestamp() then raise exception using message='PREVIEW_CHANGED'; end if;
  select * into pub from public.publications where schedule_id=p_schedule for update;
  if preview.kind='plan' then
    if pub.id is not null then
      if pub.manifest_hash<>p_hash then raise exception using message='PREVIEW_CHANGED'; end if;
      select * into op from public.ledger_operations where publication_id=pub.id and kind='plan';
    else
      if (preview.manifest->>'commitBeforeUtc')::timestamptz<clock_timestamp()+interval '10 minutes' then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
      if (select count(*) from public.publications where owner_id=p_owner and consented_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=5 then raise exception using message='PUBLICATION_RATE_LIMITED'; end if;
      insert into public.publications(schedule_id,owner_id,receipt_id,manifest,canonical_text,manifest_hash,consent_version) values(p_schedule,p_owner,preview.manifest->>'receiptId',preview.manifest,preview.canonical_text,p_hash,'public-proof-v2') returning * into pub;
      insert into public.ledger_operations(publication_id,kind,expected_hash) values(pub.id,'plan',p_hash) returning * into op;
    end if;
  else
    if pub.id is null or preview.private_vector is distinct from public.cs_schedule_vector(p_schedule) then raise exception using message='PREVIEW_CHANGED'; end if;
    if exists(select 1 from public.ledger_operations where publication_id=pub.id and status<>'confirmed') then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    select * into prior from public.published_results where publication_id=pub.id order by public_sequence desc limit 1;
    if (preview.manifest->>'publicRevision')::integer<>coalesce(prior.public_sequence,0)+1 or preview.manifest->>'previousResultHash'<>coalesce(prior.manifest_hash,'0x'||repeat('0',64)) then raise exception using message='PREVIEW_CHANGED'; end if;
    if exists(select 1 from public.published_results where publication_id=pub.id and private_vector_digest=encode(extensions.digest(preview.private_vector::text,'sha256'),'hex')) then raise exception using message='PREVIEW_CHANGED'; end if;
    if (select count(*) from public.published_results r join public.publications pp on pp.id=r.publication_id where pp.owner_id=p_owner and r.consented_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception using message='PUBLICATION_RATE_LIMITED'; end if;
    insert into public.published_results(publication_id,public_sequence,manifest,canonical_text,manifest_hash,consent_version,private_vector_digest) values(pub.id,(preview.manifest->>'publicRevision')::integer,preview.manifest,preview.canonical_text,p_hash,'public-proof-v2',encode(extensions.digest(preview.private_vector::text,'sha256'),'hex')) returning * into item;
    insert into public.ledger_operations(publication_id,result_id,kind,expected_hash) values(pub.id,item.id,'result',p_hash) returning * into op;
  end if;
  ack:=jsonb_build_object('operationId',op.id,'receiptId',pub.receipt_id,'manifestHash',op.expected_hash);
  insert into public.lifecycle_mutations(owner_id,scope,key,request_digest,response) values(p_owner,command_scope,p_key,p_digest,ack) on conflict(owner_id,scope,key) do update set request_digest=excluded.request_digest,response=excluded.response,expires_at=excluded.expires_at;
  return ack;
end; $$;
create function public.cs_schedule_publication_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.ledger_operations o set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp() from public.publications p where p.schedule_id=old.id and p.id=o.publication_id and o.status in ('queued','signing') and not exists(select 1 from public.ledger_signed_transactions s where s.operation_id=o.id);
  update public.publications set schedule_id=null,owner_id=null where schedule_id=old.id;
  return old;
end; $$;
create trigger schedule_publication_delete before delete on public.schedules for each row execute function public.cs_schedule_publication_delete();

create or replace function public.cs_ledger_prepare(p_operation uuid,p_scope text,p_holder uuid,p_fence bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare op public.ledger_operations; pub public.publications; p public.plans; schedule_exists boolean:=false;
begin
  perform public.cs_ledger_assert_lease(p_scope,p_holder,p_fence);
  select * into op from public.ledger_operations where id=p_operation;
  select * into pub from public.publications where id=op.publication_id;
  if pub.plan_id is not null then select * into p from public.plans where id=pub.plan_id for update; elsif pub.schedule_id is not null then perform 1 from public.schedules where id=pub.schedule_id and owner_id=pub.owner_id for update; schedule_exists:=found; end if;
  select * into op from public.ledger_operations where id=p_operation for update;
  if op.id is null or op.status not in ('queued','signing') or exists(select 1 from public.ledger_signed_transactions where operation_id=op.id) then return false; end if;
  if pub.owner_id is null or (op.kind='plan' and ((not schedule_exists and p.status is distinct from 'accepted') or (pub.manifest->>'commitBeforeUtc')::timestamptz<clock_timestamp()+interval '10 minutes')) then
    update public.ledger_operations set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp() where id=op.id;
    return false;
  end if;
  if exists(select 1 from public.ledger_operations o where o.id<>op.id and o.status in ('signing','submitted','uncertain')) then return false; end if;
  if op.kind='result' and exists(select 1 from public.ledger_operations o left join public.published_results r on r.id=o.result_id
    where o.publication_id=pub.id and o.id<>op.id and (o.kind='plan' or r.public_sequence<(select public_sequence from public.published_results where id=op.result_id)) and o.status<>'confirmed') then return false; end if;
  update public.ledger_operations set status='signing',attempts=attempts+1,failure_code=null,updated_at=clock_timestamp() where id=op.id;
  return true;
end; $$;

create or replace function public.cs_ledger_persist_signed(p_operation uuid,p_scope text,p_holder uuid,p_fence bigint,p_nonce bigint,p_raw text,p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare op public.ledger_operations; pub public.publications; p public.plans; schedule_exists boolean:=false;
begin
  perform public.cs_ledger_assert_lease(p_scope,p_holder,p_fence);
  select * into op from public.ledger_operations where id=p_operation;
  select * into pub from public.publications where id=op.publication_id;
  if pub.plan_id is not null then select * into p from public.plans where id=pub.plan_id for update; elsif pub.schedule_id is not null then perform 1 from public.schedules where id=pub.schedule_id and owner_id=pub.owner_id for update; schedule_exists:=found; end if;
  select * into op from public.ledger_operations where id=p_operation for update;
  if op.status<>'signing' or exists(select 1 from public.ledger_signed_transactions where operation_id=op.id) then return false; end if;
  -- Cancellation/deletion and durable signing share this plan lock.
  if pub.owner_id is null or (op.kind='plan' and ((not schedule_exists and p.status is distinct from 'accepted') or (pub.manifest->>'commitBeforeUtc')::timestamptz<clock_timestamp()+interval '10 minutes')) then
    update public.ledger_operations set status='failed',failure_code='CANCELLED_OR_EXPIRED',updated_at=clock_timestamp() where id=op.id; return false;
  end if;
  insert into public.ledger_signed_transactions(operation_id,signer,chain_id,nonce,raw_transaction,transaction_hash)
    values(op.id,split_part(p_scope,':',2),11155111,p_nonce,p_raw,p_hash);
  update public.ledger_operations set status='submitted',transaction_hash=p_hash,updated_at=clock_timestamp() where id=op.id;
  return true;
end; $$;

do $$ declare item record; begin
  for item in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('cs_schedule_vector','cs_schedule_receipt_identity','cs_schedule_publication_preview','cs_schedule_publication_consent','cs_schedule_publication_delete') loop
    execute format('revoke all on function %s from public,anon,authenticated',item.signature);
    execute format('grant execute on function %s to service_role',item.signature);
  end loop;
end $$;
