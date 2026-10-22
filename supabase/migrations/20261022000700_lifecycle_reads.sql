-- A single SQL snapshot prevents a detail/page from mixing report/result generations.
create function public.cs_read_private_plan(p_plan uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('plan',to_jsonb(p),'forecastSnapshot',s.snapshot,'forecastHash',s.digest,
    'reports',coalesce((select jsonb_agg(r.document order by r.sequence) from public.completion_reports r where r.plan_id=p.id),'[]'::jsonb),
    'revisions',coalesce((select jsonb_agg(r.document order by r.sequence) from public.result_revisions r where r.plan_id=p.id),'[]'::jsonb))
  from public.plans p join public.grid_snapshots s on s.id=(p.accepted_payload->>'forecastSnapshotId')::uuid
  where p.id=p_plan and p.owner_id=(select auth.uid());
$$;
revoke all on function public.cs_read_private_plan(uuid) from public,anon;
grant execute on function public.cs_read_private_plan(uuid) to authenticated;
create function public.cs_read_private_plan_page(p_limit integer,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(item order by accepted_at desc,id desc),'[]'::jsonb) from (
    select p.id,p.accepted_at,to_jsonb(p)||jsonb_build_object('completion',coalesce((select r.kind from public.completion_reports r where r.plan_id=p.id order by r.sequence desc limit 1),'not_reported')) item
    from public.plans p where p.owner_id=(select auth.uid()) and (p_before_time is null or (p.accepted_at,p.id)<(p_before_time,p_before_id))
    order by p.accepted_at desc,p.id desc limit greatest(1,least(20,p_limit))+1
  ) page;
$$;
revoke all on function public.cs_read_private_plan_page(integer,timestamptz,uuid) from public,anon;
grant execute on function public.cs_read_private_plan_page(integer,timestamptz,uuid) to authenticated;
create function public.cs_prune_lifecycle_mutations() returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;
begin
  delete from public.lifecycle_mutations where expires_at<=clock_timestamp();
  get diagnostics removed=row_count;
  return removed;
end; $$;
revoke all on function public.cs_prune_lifecycle_mutations() from public,anon,authenticated;
grant execute on function public.cs_prune_lifecycle_mutations() to service_role;
-- Documents consumed by later proof code must agree with their relational identities.
alter table public.completion_reports add constraint report_document_identity check(coalesce(
  document ?& array['schemaVersion','id','planId','sequence','createdAtUtc','kind','reportedStartUtc','profileStillApplicable','correctsReportId','reason','source']
  and document->>'schemaVersion'='1' and document->>'kind'=kind
  and (document->>'createdAtUtc')::timestamptz=created_at
  and (document->>'reportedStartUtc')::timestamptz is not distinct from reported_start
  and (document->>'profileStillApplicable')::boolean is not distinct from profile_still_applicable
  and (document->>'correctsReportId')::uuid is not distinct from prior_report_id
  and document->>'reason'=reason and document->>'source' in ('report','cancellation')
  and (document->>'source'<>'cancellation' or (kind='did_not_run' and reason='cancelled_before_start' and prior_report_id is null)),false));
alter table public.result_revisions add constraint result_document_identity check(coalesce(
  document ?& array['schemaVersion','id','planId','sequence','reportId','createdAtUtc','reason','actualSnapshotId','result']
  and document->>'schemaVersion'='1' and (document->>'createdAtUtc')::timestamptz=created_at
  and (document->>'actualSnapshotId')::uuid is not distinct from actual_snapshot_id
  and document->'result'->>'reportId'=report_id::text
  and document->>'reason' in ('submitted','correction','refresh','cancelled'),false));
