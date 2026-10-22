-- M07: append-only completion history. Public evidence remains outside this migration.
alter table public.plans add constraint plans_id_owner unique(id,owner_id);
create table public.completion_reports (
  id uuid primary key, plan_id uuid not null, owner_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null check(sequence>0), kind text not null check(kind in ('ran','did_not_run')),
  reported_start timestamptz, profile_still_applicable boolean, prior_report_id uuid,
  reason text not null check(length(reason)<=500), created_at timestamptz not null,
  document jsonb not null,
  unique(plan_id,sequence), unique(id,plan_id,owner_id),
  foreign key(plan_id,owner_id) references public.plans(id,owner_id) on delete cascade,
  foreign key(prior_report_id,plan_id,owner_id) references public.completion_reports(id,plan_id,owner_id),
  check((kind='ran' and reported_start is not null and profile_still_applicable is not null and reported_start=date_trunc('minute',reported_start)) or (kind='did_not_run' and reported_start is null and profile_still_applicable is null)),
  check(prior_report_id is null or length(trim(reason))>0),
  check(document->>'id'=id::text and document->>'planId'=plan_id::text and (document->>'sequence')::int=sequence)
);
create table public.result_revisions (
  id uuid primary key, plan_id uuid not null, owner_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null, sequence integer not null check(sequence>0), actual_snapshot_id uuid references public.grid_snapshots(id),
  document jsonb not null, semantic_digest text not null check(semantic_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null, unique(plan_id,sequence),
  foreign key(plan_id,owner_id) references public.plans(id,owner_id) on delete cascade,
  foreign key(report_id,plan_id,owner_id) references public.completion_reports(id,plan_id,owner_id) on delete cascade,
  check(document->>'id'=id::text and document->>'planId'=plan_id::text and document->>'reportId'=report_id::text and (document->>'sequence')::int=sequence)
);
create table public.lifecycle_mutations (
  owner_id uuid not null references auth.users(id) on delete cascade, scope text not null, key text not null check(key ~ '^[A-Za-z0-9_-]{8,128}$'),
  request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'), response jsonb not null,
  expires_at timestamptz not null default clock_timestamp()+interval '24 hours', primary key(owner_id,scope,key)
);
alter table public.completion_reports enable row level security;
alter table public.result_revisions enable row level security;
alter table public.lifecycle_mutations enable row level security;
revoke all on public.completion_reports, public.result_revisions, public.lifecycle_mutations from public,anon,authenticated;
grant select on public.completion_reports, public.result_revisions to authenticated;
grant all on public.completion_reports, public.result_revisions, public.lifecycle_mutations to service_role;
create policy reports_owner on public.completion_reports for select to authenticated using(owner_id=(select auth.uid()));
create policy results_owner on public.result_revisions for select to authenticated using(owner_id=(select auth.uid()));
create trigger reports_immutable before update on public.completion_reports for each row execute function public.cs_immutable();
create trigger results_immutable before update on public.result_revisions for each row execute function public.cs_immutable();
drop policy snapshots_owner on public.grid_snapshots;
create policy snapshots_owner on public.grid_snapshots for select to authenticated using(
  exists(select 1 from public.comparisons c where c.snapshot_id=grid_snapshots.id and c.owner_id=(select auth.uid())) or
  exists(select 1 from public.result_revisions r where r.actual_snapshot_id=grid_snapshots.id and r.owner_id=(select auth.uid()))
);
drop trigger plans_immutable on public.plans;
create function public.cs_guard_plan_update() returns trigger language plpgsql set search_path='' as $$
begin
  if (to_jsonb(new)-'status'-'version') is distinct from (to_jsonb(old)-'status'-'version')
    or new.version<>old.version+1 or old.status='cancelled' or new.status not in ('accepted','cancelled') then
    raise exception using errcode='P0001',message='IMMUTABLE_RECORD';
  end if;
  return new;
end; $$;
revoke all on function public.cs_guard_plan_update() from public,anon,authenticated;
create trigger plan_update_guard before update on public.plans for each row execute function public.cs_guard_plan_update();

create function public.cs_prune_private_snapshots(p_ids uuid[]) returns void language sql security definer set search_path='' as $$
  delete from public.grid_snapshots s where s.id=any(p_ids)
  and not exists(select 1 from public.comparisons c where c.snapshot_id=s.id)
  and not exists(select 1 from public.result_revisions r where r.actual_snapshot_id=s.id);
$$;
revoke all on function public.cs_prune_private_snapshots(uuid[]) from public,anon,authenticated;
grant execute on function public.cs_prune_private_snapshots(uuid[]) to service_role;

create function public.cs_lifecycle_replay(p_owner uuid,p_plan uuid,p_action text,p_key text,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.lifecycle_mutations;
begin
  select * into m from public.lifecycle_mutations where owner_id=p_owner and scope=p_plan::text||':'||p_action and key=p_key and expires_at>clock_timestamp();
  if found then
    if m.request_digest<>p_digest then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return m.response;
  end if;
  return null;
end; $$;
revoke all on function public.cs_lifecycle_replay(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cs_lifecycle_replay(uuid,uuid,text,text,text) to service_role;

create function public.cs_lifecycle_commit(p_owner uuid,p_plan uuid,p_action text,p_key text,p_digest text,p_expected_version integer,
  p_report jsonb,p_result jsonb,p_semantic text,p_snapshot_text text,p_snapshot_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  plan public.plans; current_report public.completion_reports; current_result public.result_revisions;
  ack jsonb; stamp timestamptz:=clock_timestamp(); next_report integer; next_result integer; comparison_id uuid; snapshot_ids uuid[];
  snapshot_id uuid; frozen public.grid_snapshots;
begin
  if p_action not in ('report','cancel','refresh','delete') or p_key !~ '^[A-Za-z0-9_-]{8,128}$' or p_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_plan::text||':'||p_action||':'||p_key,0));
  ack:=public.cs_lifecycle_replay(p_owner,p_plan,p_action,p_key,p_digest);
  if ack is not null then return ack; end if;
  select * into plan from public.plans where id=p_plan and owner_id=p_owner for update;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  if plan.version<>p_expected_version then raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
  select * into current_report from public.completion_reports where plan_id=p_plan order by sequence desc limit 1;
  select * into current_result from public.result_revisions where plan_id=p_plan order by sequence desc limit 1;
  next_report:=coalesce(current_report.sequence,0)+1; next_result:=coalesce(current_result.sequence,0)+1;
  if p_action='delete' then
    comparison_id:=plan.comparison_id;
    select array_agg(id) into snapshot_ids from (
      select c.snapshot_id as id from public.comparisons c where c.id=comparison_id
      union select r.actual_snapshot_id from public.result_revisions r where r.plan_id=p_plan and r.actual_snapshot_id is not null
    ) snapshots;
    delete from public.plans where id=p_plan;
    delete from public.comparisons where id=comparison_id and owner_id=p_owner;
    perform public.cs_prune_private_snapshots(snapshot_ids);
    ack:=jsonb_build_object('planId',p_plan,'planVersion',plan.version,'reportId',null,'resultId',null,'changed',true,'deleted',true);
  else
    if plan.status='cancelled' then raise exception using errcode='P0001',message='PLAN_CANCELLED'; end if;
    if p_action in ('report','cancel') then
      if (p_report->>'planId')::uuid<>p_plan or (p_report->>'sequence')::int<>next_report
        or (p_report->>'correctsReportId')::uuid is distinct from current_report.id
        or (p_report->>'createdAtUtc')::timestamptz>stamp or (p_report->>'createdAtUtc')::timestamptz<plan.accepted_at then
        raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
      if p_action='cancel' then
        if current_report.id is not null or stamp>=(plan.accepted_payload->'selected'->>'startUtc')::timestamptz
          or p_report->>'kind'<>'did_not_run' or p_report->>'source'<>'cancellation' or p_report->>'reason'<>'cancelled_before_start' then
          raise exception using errcode='P0001',message='INVALID_REPORT'; end if;
      else
        if p_report->>'source'<>'report' or
          (p_report->>'kind'='did_not_run' and (p_report->>'createdAtUtc')::timestamptz<(plan.accepted_payload->'selected'->>'endUtc')::timestamptz) or
          (p_report->>'kind'='ran' and ((p_report->>'reportedStartUtc')::timestamptz<plan.accepted_at or
          (p_report->>'reportedStartUtc')::timestamptz+((plan.accepted_payload->'constraints'->>'durationMinutes')::int*interval '1 minute')>(p_report->>'createdAtUtc')::timestamptz)) then
          raise exception using errcode='P0001',message='INVALID_REPORT'; end if;
      end if;
      insert into public.completion_reports(id,plan_id,owner_id,sequence,kind,reported_start,profile_still_applicable,prior_report_id,reason,created_at,document)
        values((p_report->>'id')::uuid,p_plan,p_owner,next_report,p_report->>'kind',(p_report->>'reportedStartUtc')::timestamptz,
          (p_report->>'profileStillApplicable')::boolean,(p_report->>'correctsReportId')::uuid,p_report->>'reason',(p_report->>'createdAtUtc')::timestamptz,p_report)
        returning * into current_report;
    elsif current_report.id is null then raise exception using errcode='P0001',message='INVALID_REPORT'; end if;
    if (p_result->>'reportId')::uuid is distinct from current_report.id or (p_result->>'planId')::uuid<>p_plan or (p_result->>'sequence')::int<>next_result then
      raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
    if p_action='refresh' and p_semantic=current_result.semantic_digest then
      ack:=jsonb_build_object('planId',p_plan,'planVersion',plan.version,'reportId',current_report.id,'resultId',current_result.id,'changed',false,'deleted',false);
    else
      snapshot_id:=(p_result->>'actualSnapshotId')::uuid;
      if snapshot_id is not null then
        insert into public.grid_snapshots(id,payload_text,digest,retrieved_at) values(snapshot_id,p_snapshot_text,p_snapshot_hash,(p_snapshot_text::jsonb->>'retrievedAtUtc')::timestamptz) on conflict(id) do nothing;
        select * into strict frozen from public.grid_snapshots where id=snapshot_id;
        if frozen.payload_text<>p_snapshot_text or frozen.digest<>p_snapshot_hash or p_result->'result'->>'snapshotHash'<>frozen.digest then raise exception using errcode='P0001',message='SNAPSHOT_CONFLICT'; end if;
      elsif p_result->'result'->>'snapshotHash' is not null then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
      insert into public.result_revisions(id,plan_id,owner_id,report_id,sequence,actual_snapshot_id,document,semantic_digest,created_at)
        values((p_result->>'id')::uuid,p_plan,p_owner,current_report.id,next_result,snapshot_id,p_result,p_semantic,(p_result->>'createdAtUtc')::timestamptz)
        returning * into current_result;
      update public.plans set version=version+1,status=case when p_action='cancel' then 'cancelled' else status end where id=p_plan returning * into plan;
      ack:=jsonb_build_object('planId',p_plan,'planVersion',plan.version,'reportId',current_report.id,'resultId',current_result.id,'changed',true,'deleted',false);
    end if;
  end if;
  delete from public.lifecycle_mutations where owner_id=p_owner and scope=p_plan::text||':'||p_action and key=p_key;
  insert into public.lifecycle_mutations(owner_id,scope,key,request_digest,response) values(p_owner,p_plan::text||':'||p_action,p_key,p_digest,ack);
  return ack;
end; $$;
revoke all on function public.cs_lifecycle_commit(uuid,uuid,text,text,text,integer,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.cs_lifecycle_commit(uuid,uuid,text,text,text,integer,jsonb,jsonb,text,text,text) to service_role;

create function public.cs_private_account_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
  select array_agg(id) into ids from (select snapshot_id id from public.comparisons where owner_id=old.id union select actual_snapshot_id from public.result_revisions where owner_id=old.id and actual_snapshot_id is not null) snapshots;
  delete from public.plans where owner_id=old.id;
  delete from public.comparisons where owner_id=old.id;
  perform public.cs_prune_private_snapshots(ids);
  return old;
end; $$;
revoke all on function public.cs_private_account_cleanup() from public,anon,authenticated;
create trigger carbonshift_delete_private_data before delete on auth.users for each row execute function public.cs_private_account_cleanup();
