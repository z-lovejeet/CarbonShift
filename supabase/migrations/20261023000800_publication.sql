-- M09: consented immutable public copies; no anonymous table access.
create table public.publication_identities (
  plan_id uuid primary key references public.plans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  receipt_id text not null unique check(receipt_id ~ '^0x[0-9a-f]{64}$'),
  nonce text not null check(nonce ~ '^0x[0-9a-f]{64}$'),
  contract_address text not null check(contract_address ~ '^0x[0-9a-f]{40}$')
);
create table public.publication_previews (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, plan_version integer not null,
  kind text not null check(kind in ('plan','result')), private_result_id uuid references public.result_revisions(id) on delete cascade,
  manifest jsonb not null, canonical_text text not null check(octet_length(canonical_text)<=262144),
  manifest_hash text not null check(manifest_hash ~ '^0x[0-9a-f]{64}$'),
  consent_version text not null default 'public-proof-v1' check(consent_version='public-proof-v1'),
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  check(manifest=canonical_text::jsonb), check(expires_at>created_at),
  check((kind='plan')=(private_result_id is null)),
  check(manifest_hash='0x'||encode(extensions.digest('CarbonShift:'||kind||':v1'||chr(10)||canonical_text,'sha256'),'hex'))
);
create table public.publications (
  id uuid primary key default gen_random_uuid(), plan_id uuid unique references public.plans(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null, receipt_id text not null unique,
  manifest jsonb not null, canonical_text text not null, manifest_hash text not null,
  consent_version text not null check(consent_version='public-proof-v1'), consented_at timestamptz not null default clock_timestamp(),
  check(manifest=canonical_text::jsonb and manifest->>'receiptId'=receipt_id),
  check(manifest_hash='0x'||encode(extensions.digest('CarbonShift:plan:v1'||chr(10)||canonical_text,'sha256'),'hex'))
);
create table public.published_results (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.publications(id),
  result_revision_id uuid references public.result_revisions(id) on delete set null,
  public_sequence integer not null check(public_sequence between 1 and 100),
  manifest jsonb not null, canonical_text text not null, manifest_hash text not null,
  consent_version text not null check(consent_version='public-proof-v1'), consented_at timestamptz not null default clock_timestamp(),
  unique(publication_id,public_sequence), unique(publication_id,result_revision_id),
  check(manifest=canonical_text::jsonb and (manifest->>'publicRevision')::integer=public_sequence),
  check(manifest_hash='0x'||encode(extensions.digest('CarbonShift:result:v1'||chr(10)||canonical_text,'sha256'),'hex'))
);
create table public.ledger_operations (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.publications(id),
  result_id uuid unique references public.published_results(id), kind text not null check(kind in ('plan','result')),
  expected_hash text not null, status text not null default 'queued' check(status in ('queued','signing','submitted','confirmed','failed','uncertain')),
  failure_code text, attempts integer not null default 0, transaction_hash text, block_number bigint, block_hash text,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), checked_at timestamptz,
  check((kind='plan')=(result_id is null))
);
create unique index one_plan_operation on public.ledger_operations(publication_id) where kind='plan';
create table public.ledger_signed_transactions (
  operation_id uuid primary key references public.ledger_operations(id), signer text not null,
  chain_id integer not null check(chain_id=11155111), nonce bigint not null check(nonce>=0),
  raw_transaction text not null check(raw_transaction ~ '^0x[0-9a-f]+$'), transaction_hash text not null unique,
  created_at timestamptz not null default clock_timestamp(), unique(chain_id,signer,nonce)
);
create table public.ledger_worker_leases (
  scope text primary key, holder uuid not null, fence bigint not null default 1, expires_at timestamptz not null
);
do $$ declare t text; begin
  foreach t in array array['publication_identities','publication_previews','publications','published_results','ledger_operations','ledger_signed_transactions','ledger_worker_leases'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant select on public.publications,public.published_results,public.ledger_operations to authenticated;
create policy publication_owner on public.publications for select to authenticated using(owner_id=(select auth.uid()));
create policy public_result_owner on public.published_results for select to authenticated using(exists(select 1 from public.publications p where p.id=publication_id and p.owner_id=(select auth.uid())));
create policy operation_owner on public.ledger_operations for select to authenticated using(exists(select 1 from public.publications p where p.id=publication_id and p.owner_id=(select auth.uid())));
create trigger identity_immutable before update on public.publication_identities for each row execute function public.cs_immutable();
create trigger preview_immutable before update on public.publication_previews for each row execute function public.cs_immutable();
create trigger signed_immutable before update or delete on public.ledger_signed_transactions for each row execute function public.cs_immutable();
create function public.cs_guard_public_copy() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using message='IMMUTABLE_RECORD'; end if;
  if tg_table_name='publications' then
    if (to_jsonb(new)-'owner_id'-'plan_id') is distinct from (to_jsonb(old)-'owner_id'-'plan_id') or
      (new.owner_id is distinct from old.owner_id and new.owner_id is not null) or (new.plan_id is distinct from old.plan_id and new.plan_id is not null) then raise exception using message='IMMUTABLE_RECORD'; end if;
  else
    if (to_jsonb(new)-'result_revision_id') is distinct from (to_jsonb(old)-'result_revision_id') or
      (new.result_revision_id is distinct from old.result_revision_id and new.result_revision_id is not null) then raise exception using message='IMMUTABLE_RECORD'; end if;
  end if;
  return new;
end; $$;
create trigger publication_immutable before update or delete on public.publications for each row execute function public.cs_guard_public_copy();
create trigger public_result_immutable before update or delete on public.published_results for each row execute function public.cs_guard_public_copy();

create function public.cs_publication_identity(p_owner uuid,p_plan uuid,p_receipt text,p_nonce text,p_contract text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare identity public.publication_identities;
begin
  perform 1 from auth.users where id=p_owner for key share;
  perform 1 from public.plans where id=p_plan and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  insert into public.publication_identities values(p_plan,p_owner,p_receipt,p_nonce,p_contract) on conflict(plan_id) do nothing;
  select * into strict identity from public.publication_identities where plan_id=p_plan and owner_id=p_owner;
  if identity.contract_address<>p_contract then raise exception using message='PREVIEW_CHANGED'; end if;
  return jsonb_build_object('receiptId',identity.receipt_id,'nonce',identity.nonce,'contractAddress',identity.contract_address);
end; $$;

create function public.cs_publication_preview(p_owner uuid,p_plan uuid,p_version integer,p_result uuid,p_manifest text,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.plans; pub public.publications; prior public.published_results; draft public.publication_previews;
  m jsonb:=p_manifest::jsonb; stamp timestamptz:=clock_timestamp(); expiry timestamptz; cutoff timestamptz; private_sequence integer;
begin
  perform 1 from auth.users where id=p_owner for key share;
  select * into p from public.plans where id=p_plan and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  if p.version<>p_version then raise exception using message='PREVIEW_CHANGED'; end if;
  select * into pub from public.publications where plan_id=p_plan;
  expiry:=stamp+interval '5 minutes';
  if p_result is null then
    cutoff:=least((p.accepted_payload->'baseline'->>'startUtc')::timestamptz,(p.accepted_payload->'selected'->>'startUtc')::timestamptz);
    expiry:=least(expiry,cutoff-interval '10 minutes');
    if p.status<>'accepted' or pub.id is not null or expiry<=stamp then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    if not exists(select 1 from public.publication_identities i where i.plan_id=p_plan and i.receipt_id=m->>'receiptId' and i.nonce=m->>'nonce' and i.contract_address=m->>'contractAddress') or
      (m->>'commitBeforeUtc')::timestamptz<>cutoff then raise exception using message='PREVIEW_CHANGED'; end if;
  else
    select sequence into private_sequence from public.result_revisions where id=p_result and plan_id=p_plan and owner_id=p_owner;
    if private_sequence is null then raise exception using message='NOT_FOUND'; end if;
    if pub.id is null or not exists(select 1 from public.ledger_operations where publication_id=pub.id and kind='plan' and status='confirmed') or
      exists(select 1 from public.ledger_operations where publication_id=pub.id and status<>'confirmed') then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    select * into prior from public.published_results where publication_id=pub.id order by public_sequence desc limit 1;
    if exists(select 1 from public.published_results where publication_id=pub.id and result_revision_id=p_result) or
      private_sequence<=coalesce((prior.manifest->>'privateResultRevisionNumber')::integer,0) or
      (m->>'publicRevision')::integer<>coalesce(prior.public_sequence,0)+1 or m->>'previousResultHash'<>coalesce(prior.manifest_hash,'0x'||repeat('0',64)) or
      m->>'planHash'<>pub.manifest_hash or m->>'receiptId'<>pub.receipt_id or (m->>'privateResultRevisionNumber')::integer<>private_sequence then raise exception using message='PREVIEW_CHANGED'; end if;
  end if;
  -- A concurrent identical request reuses the already frozen nonce/bytes.
  select * into draft from public.publication_previews where plan_id=p_plan and plan_version=p_version and private_result_id is not distinct from p_result
    and (manifest-'nonce')=(m-'nonce') and expires_at>stamp order by created_at desc limit 1;
  if draft.id is null then
    insert into public.publication_previews(plan_id,owner_id,plan_version,kind,private_result_id,manifest,canonical_text,manifest_hash,expires_at)
      values(p_plan,p_owner,p_version,case when p_result is null then 'plan' else 'result' end,p_result,m,p_manifest,p_hash,expiry) returning * into draft;
  end if;
  return to_jsonb(draft);
end; $$;

create function public.cs_publication_consent(p_owner uuid,p_plan uuid,p_preview uuid,p_hash text,p_consent text,p_key text,p_digest text,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.plans; preview public.publication_previews; pub public.publications; prior public.published_results; item public.published_results;
  op public.ledger_operations; saved public.lifecycle_mutations; ack jsonb; stamp timestamptz:=clock_timestamp(); command_scope text:='publication:'||p_plan::text;
begin
  if p_key !~ '^[A-Za-z0-9_-]{8,128}$' or p_digest !~ '^[0-9a-f]{64}$' or p_consent<>'public-proof-v1' then raise exception using message='INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||command_scope||':'||p_key,0));
  select * into saved from public.lifecycle_mutations where owner_id=p_owner and lifecycle_mutations.scope=command_scope and key=p_key and expires_at>stamp;
  if found then
    if saved.request_digest<>p_digest then raise exception using message='IDEMPOTENCY_CONFLICT'; end if;
    return saved.response;
  end if;
  perform 1 from auth.users where id=p_owner for update;
  select * into p from public.plans where id=p_plan and owner_id=p_owner for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  select * into preview from public.publication_previews where id=p_preview and plan_id=p_plan and owner_id=p_owner;
  if not found or preview.manifest_hash<>p_hash or preview.consent_version<>p_consent or preview.expires_at<=stamp or preview.plan_version<>p.version then raise exception using message='PREVIEW_CHANGED'; end if;
  if (preview.kind='plan') is distinct from (p_revision is null) or p_revision is not null and (preview.manifest->>'privateResultRevisionNumber')::integer<>p_revision then raise exception using message='PREVIEW_CHANGED'; end if;
  select * into pub from public.publications where plan_id=p_plan for update;
  if preview.kind='plan' then
    if pub.id is not null then
      if pub.manifest_hash<>p_hash then raise exception using message='PREVIEW_CHANGED'; end if;
      select * into op from public.ledger_operations where publication_id=pub.id and kind='plan';
    else
      if p.status<>'accepted' or (preview.manifest->>'commitBeforeUtc')::timestamptz<stamp+interval '10 minutes' then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
      if (select count(*) from public.publications where owner_id=p_owner and consented_at>=date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC')>=5 then raise exception using message='PUBLICATION_RATE_LIMITED'; end if;
      insert into public.publications(plan_id,owner_id,receipt_id,manifest,canonical_text,manifest_hash,consent_version)
        values(p_plan,p_owner,preview.manifest->>'receiptId',preview.manifest,preview.canonical_text,p_hash,p_consent) returning * into pub;
      insert into public.ledger_operations(publication_id,kind,expected_hash) values(pub.id,'plan',p_hash) returning * into op;
    end if;
  else
    if pub.id is null then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
    select * into item from public.published_results where publication_id=pub.id and result_revision_id=preview.private_result_id;
    if item.id is not null then
      if item.manifest_hash<>p_hash then raise exception using message='PREVIEW_CHANGED'; end if;
      select * into op from public.ledger_operations where result_id=item.id;
    else
      if exists(select 1 from public.ledger_operations where publication_id=pub.id and status<>'confirmed') then raise exception using message='PUBLICATION_NOT_ALLOWED'; end if;
      select * into prior from public.published_results where publication_id=pub.id order by public_sequence desc limit 1;
      if (preview.manifest->>'publicRevision')::integer<>coalesce(prior.public_sequence,0)+1 or preview.manifest->>'previousResultHash'<>coalesce(prior.manifest_hash,'0x'||repeat('0',64)) then raise exception using message='PREVIEW_CHANGED'; end if;
      if (select count(*) from public.published_results r join public.publications pp on pp.id=r.publication_id where pp.owner_id=p_owner and r.consented_at>=date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC')>=20 then raise exception using message='PUBLICATION_RATE_LIMITED'; end if;
      insert into public.published_results(publication_id,result_revision_id,public_sequence,manifest,canonical_text,manifest_hash,consent_version)
        values(pub.id,preview.private_result_id,(preview.manifest->>'publicRevision')::integer,preview.manifest,preview.canonical_text,p_hash,p_consent) returning * into item;
      insert into public.ledger_operations(publication_id,result_id,kind,expected_hash) values(pub.id,item.id,'result',p_hash) returning * into op;
    end if;
  end if;
  ack:=jsonb_build_object('operationId',op.id,'receiptId',pub.receipt_id,'manifestHash',op.expected_hash);
  delete from public.lifecycle_mutations where owner_id=p_owner and lifecycle_mutations.scope=command_scope and key=p_key;
  insert into public.lifecycle_mutations(owner_id,scope,key,request_digest,response) values(p_owner,command_scope,p_key,p_digest,ack);
  return ack;
end; $$;

-- Restrict every new elevated/trigger function, including the default PUBLIC grant.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('cs_guard_public_copy','cs_publication_identity','cs_publication_preview','cs_publication_consent') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
