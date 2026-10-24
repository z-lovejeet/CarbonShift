alter table public.schedule_tasks add unique(schedule_id,task_id,owner_id);
create table public.schedule_reports (
  id uuid primary key, schedule_id uuid not null, task_id text not null, owner_id uuid not null,
  sequence integer not null check(sequence>0), previous_report_id uuid, payload jsonb not null,
  unique(schedule_id,task_id,sequence), unique(id,schedule_id,task_id),
  foreign key(schedule_id,task_id,owner_id) references public.schedule_tasks(schedule_id,task_id,owner_id) on delete cascade,
  foreign key(previous_report_id,schedule_id,task_id) references public.schedule_reports(id,schedule_id,task_id),
  check((payload->>'id')::uuid=id and payload->>'taskId'=task_id and (payload->>'scheduleId')::uuid=schedule_id and (payload->>'sequence')::integer=sequence and payload->>'schemaVersion'='2')
);
create table public.schedule_results (
  id uuid primary key, schedule_id uuid not null, task_id text not null, owner_id uuid not null,
  report_id uuid not null, sequence integer not null check(sequence>0), semantic_digest text not null check(semantic_digest ~ '^[0-9a-f]{64}$'), payload jsonb not null,
  unique(schedule_id,task_id,sequence),
  foreign key(schedule_id,task_id,owner_id) references public.schedule_tasks(schedule_id,task_id,owner_id) on delete cascade,
  foreign key(report_id,schedule_id,task_id) references public.schedule_reports(id,schedule_id,task_id) on delete cascade,
  check((payload->>'id')::uuid=id and (payload->>'reportId')::uuid=report_id and payload->>'taskId'=task_id and (payload->>'scheduleId')::uuid=schedule_id and (payload->>'sequence')::integer=sequence and payload->>'schemaVersion'='2')
);
create table public.schedule_lifecycle_keys (
  owner_id uuid not null references auth.users(id) on delete cascade, schedule_id uuid not null references public.schedules(id) on delete cascade,
  scope text not null, key uuid not null, digest text not null check(digest ~ '^[0-9a-f]{64}$'), response jsonb not null,
  created_at timestamptz not null default now(), primary key(owner_id,scope,key)
);
alter table public.schedule_reports enable row level security;
alter table public.schedule_results enable row level security;
alter table public.schedule_lifecycle_keys enable row level security;
revoke all on public.schedule_reports,public.schedule_results,public.schedule_lifecycle_keys from public,anon,authenticated;
grant select on public.schedule_reports,public.schedule_results to authenticated;
grant all on public.schedule_reports,public.schedule_results,public.schedule_lifecycle_keys to service_role;
create policy schedule_reports_owner on public.schedule_reports for select to authenticated using(owner_id=(select auth.uid()));
create policy schedule_results_owner on public.schedule_results for select to authenticated using(owner_id=(select auth.uid()));
create trigger schedule_reports_immutable before update on public.schedule_reports for each row execute function public.cs_immutable();
create trigger schedule_results_immutable before update on public.schedule_results for each row execute function public.cs_immutable();
create function public.cs_schedule_report_commit(p_owner uuid,p_schedule uuid,p_task text,p_action text,p_key uuid,p_digest text,p_expected integer,p_report jsonb,p_result jsonb,p_semantic text) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.schedule_lifecycle_keys; latest_report public.schedule_reports; latest_result public.schedule_results; report_id uuid; report_seq integer; result_id uuid; result_seq integer; response jsonb; unchanged boolean:=false; command_scope text:=p_action||':'||p_task;
begin
  perform 1 from public.schedules where id=p_schedule and owner_id=p_owner for update;
  if not found or not exists(select 1 from public.schedule_tasks where schedule_id=p_schedule and task_id=p_task and owner_id=p_owner) then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select * into prior from public.schedule_lifecycle_keys where owner_id=p_owner and schedule_lifecycle_keys.scope=command_scope and key=p_key;
  if found then if prior.digest<>p_digest or prior.schedule_id<>p_schedule then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if; return prior.response; end if;
  select * into latest_report from public.schedule_reports where schedule_id=p_schedule and task_id=p_task order by sequence desc limit 1;
  select * into latest_result from public.schedule_results where schedule_id=p_schedule and task_id=p_task order by sequence desc limit 1;
  if p_action='report' then
    if p_expected<>coalesce(latest_report.sequence,0) or p_report is null or (p_report->>'sequence')::integer<>coalesce(latest_report.sequence,0)+1 or nullif(p_report->>'previousReportId','')::uuid is distinct from latest_report.id then raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
    report_id:=(p_report->>'id')::uuid; report_seq:=(p_report->>'sequence')::integer;
    insert into public.schedule_reports(id,schedule_id,task_id,owner_id,sequence,previous_report_id,payload) values(report_id,p_schedule,p_task,p_owner,report_seq,latest_report.id,p_report);
  elsif p_action='refresh' then
    if p_report is not null or latest_report.id is null or p_expected<>coalesce(latest_result.sequence,0) then raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
    report_id:=latest_report.id; report_seq:=latest_report.sequence;
    unchanged:=latest_result.semantic_digest=p_semantic;
  else raise exception using errcode='P0001',message='INVALID_REPORT'; end if;
  if p_result is null or (p_result->>'reportId')::uuid<>report_id then raise exception using errcode='P0001',message='INVALID_REPORT'; end if;
  if unchanged then result_id:=latest_result.id; result_seq:=latest_result.sequence;
  else
    result_id:=(p_result->>'id')::uuid; result_seq:=coalesce(latest_result.sequence,0)+1;
    if (p_result->>'sequence')::integer<>result_seq then raise exception using errcode='P0001',message='VERSION_CONFLICT'; end if;
    insert into public.schedule_results(id,schedule_id,task_id,owner_id,report_id,sequence,semantic_digest,payload) values(result_id,p_schedule,p_task,p_owner,report_id,result_seq,p_semantic,p_result);
  end if;
  response:=jsonb_build_object('schemaVersion',2,'scheduleId',p_schedule,'taskId',p_task,'reportId',report_id,'resultId',result_id,'reportSequence',report_seq,'resultSequence',result_seq,'unchanged',unchanged);
  insert into public.schedule_lifecycle_keys(owner_id,schedule_id,scope,key,digest,response) values(p_owner,p_schedule,command_scope,p_key,p_digest,response);
  return response;
end; $$;
revoke all on function public.cs_schedule_report_commit(uuid,uuid,text,text,uuid,text,integer,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.cs_schedule_report_commit(uuid,uuid,text,text,uuid,text,integer,jsonb,jsonb,text) to service_role;
create function public.cs_schedule_history(p_schedule uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('schemaVersion',2,
    'reports',coalesce((select jsonb_agg(r.payload order by r.task_id,r.sequence) from public.schedule_reports r where r.schedule_id=p_schedule),'[]'::jsonb),
    'results',coalesce((select jsonb_agg(r.payload order by r.task_id,r.sequence) from public.schedule_results r where r.schedule_id=p_schedule),'[]'::jsonb))
  where exists(select 1 from public.schedules s where s.id=p_schedule and s.owner_id=auth.uid());
$$;
revoke all on function public.cs_schedule_history(uuid) from public,anon;
grant execute on function public.cs_schedule_history(uuid) to authenticated;
