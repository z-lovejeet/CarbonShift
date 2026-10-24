-- M11: explicit service-only retention. Public/signed evidence is never purged.
create index comparisons_retention on public.comparisons(created_at);
create index schedule_comparisons_retention on public.schedule_comparisons(created_at);
create index plans_retention on public.plans(accepted_at);
create index schedules_retention on public.schedules(accepted_at);

create function public.cs_retention(p_apply boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  stamp timestamptz:=clock_timestamp(); eligible jsonb; removed jsonb:='{}'::jsonb;
  item record; n integer; total integer; batch_size constant integer:=1000;
begin
  if not pg_try_advisory_xact_lock(216250014) then return jsonb_build_object('busy',true); end if;
  eligible:=jsonb_build_object(
    'privatePlans',(select count(*) from public.plans p where p.accepted_at<stamp-interval '30 days' and not exists(select 1 from public.publications x where x.plan_id=p.id)),
    'privateSchedules',(select count(*) from public.schedules s where s.accepted_at<stamp-interval '30 days' and not exists(select 1 from public.publications x where x.schedule_id=s.id)),
    'unacceptedComparisons',(select count(*) from public.comparisons c where c.created_at<stamp-interval '24 hours' and not exists(select 1 from public.plans p where p.comparison_id=c.id)),
    'unacceptedScheduleComparisons',(select count(*) from public.schedule_comparisons c where c.created_at<stamp-interval '24 hours' and not exists(select 1 from public.schedules s where s.comparison_id=c.id)),
    'expiredAcknowledgements',(select count(*) from public.lifecycle_mutations where expires_at<=stamp),
    'expiredPlanKeys',(select count(*) from public.mutation_keys where expires_at<=stamp),
    'expiredScheduleKeys',(select count(*) from public.schedule_mutation_keys where created_at<stamp-interval '24 hours'),
    'expiredScheduleReportKeys',(select count(*) from public.schedule_lifecycle_keys where created_at<stamp-interval '24 hours'),
    'expiredScheduleCodeCache',(select count(*) from public.schedule_explanation_cache where expires_at<=stamp),
    'expiredPreviews',(select count(*) from public.publication_previews where expires_at<=stamp)+(select count(*) from public.schedule_publication_previews where expires_at<=stamp),
    'ai',public.cs_ai_retention_preview()
  );
  if p_apply then
    -- Take the same parent locks as acceptance/consent; skip active user commands.
    total:=0;
    for item in select p.id from public.plans p where p.accepted_at<stamp-interval '30 days' and not exists(select 1 from public.publications x where x.plan_id=p.id) order by p.id limit batch_size for update of p skip locked loop
      if not exists(select 1 from public.publications where plan_id=item.id) then
        delete from public.plans where id=item.id; total:=total+1;
      end if;
    end loop;
    removed:=removed||jsonb_build_object('privatePlans',total);
    total:=0;
    for item in select p.id from public.schedules p where p.accepted_at<stamp-interval '30 days' and not exists(select 1 from public.publications x where x.schedule_id=p.id) order by p.id limit batch_size for update of p skip locked loop
      if not exists(select 1 from public.publications where schedule_id=item.id) then
        delete from public.schedules where id=item.id; total:=total+1;
      end if;
    end loop;
    removed:=removed||jsonb_build_object('privateSchedules',total);
    total:=0;
    for item in select p.id from public.comparisons p where p.created_at<stamp-interval '24 hours' and not exists(select 1 from public.plans x where x.comparison_id=p.id) order by p.id limit batch_size for update of p skip locked loop
      if not exists(select 1 from public.plans where comparison_id=item.id) then
        delete from public.comparisons where id=item.id; total:=total+1;
      end if;
    end loop;
    removed:=removed||jsonb_build_object('unacceptedComparisons',total);
    total:=0;
    for item in select p.id from public.schedule_comparisons p where p.created_at<stamp-interval '24 hours' and not exists(select 1 from public.schedules x where x.comparison_id=p.id) order by p.id limit batch_size for update of p skip locked loop
      if not exists(select 1 from public.schedules where comparison_id=item.id) then
        delete from public.schedule_comparisons where id=item.id; total:=total+1;
      end if;
    end loop;
    removed:=removed||jsonb_build_object('unacceptedScheduleComparisons',total);
    delete from public.lifecycle_mutations where expires_at<=stamp;
    get diagnostics n=row_count; removed:=removed||jsonb_build_object('expiredAcknowledgements',n);
    delete from public.mutation_keys where expires_at<=stamp;
    delete from public.schedule_mutation_keys where created_at<stamp-interval '24 hours';
    delete from public.schedule_lifecycle_keys where created_at<stamp-interval '24 hours';
    delete from public.schedule_explanation_cache where expires_at<=stamp;
    delete from public.publication_previews where expires_at<=stamp;
    delete from public.schedule_publication_previews where expires_at<=stamp;
    delete from public.usage_buckets where window_start<stamp-interval '7 days';
    perform public.cs_ai_prune();
    delete from public.grid_snapshots g where g.created_at<stamp-interval '24 hours'
      and not exists(select 1 from public.comparisons c where c.snapshot_id=g.id)
      and not exists(select 1 from public.result_revisions r where r.actual_snapshot_id=g.id);
    get diagnostics n=row_count; removed:=removed||jsonb_build_object('orphanSnapshots',n);
  end if;
  return jsonb_build_object('busy',false,'mode',case when p_apply then 'apply' else 'dry-run' end,'batchLimit',batch_size,'eligible',eligible,'removed',removed);
end; $$;
revoke all on function public.cs_retention(boolean) from public,anon,authenticated;
grant execute on function public.cs_retention(boolean) to service_role;
