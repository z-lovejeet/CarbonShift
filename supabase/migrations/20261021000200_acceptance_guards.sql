-- Defense in depth: a faulty privileged caller cannot insert a changed accepted payload.
alter table public.plans alter column accepted_at set default date_trunc('second', now());
alter table public.plans add constraint plans_whole_second_acceptance check (accepted_at = date_trunc('second',accepted_at));
alter table public.comparisons add constraint comparison_required_fields check (
  payload ?& array['constraints','forecastSnapshotId','forecastSnapshotHash','baseline','selected','alternatives','differenceMg','differencePercent','methodVersion','createdAtUtc','expiresAtUtc']
  and coalesce(jsonb_typeof(payload->'constraints')='object',false)
  and coalesce(jsonb_typeof(payload->'baseline')='object',false)
  and coalesce(jsonb_typeof(payload->'selected')='object',false)
  and coalesce(jsonb_typeof(payload->'alternatives')='array',false)
  and coalesce(jsonb_typeof(payload->'differenceMg')='number',false)
);
create function public.cs_guard_plan_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare proposal public.comparisons;
begin
  select * into proposal from public.comparisons where id=new.comparison_id and owner_id=new.owner_id;
  if not found then raise exception using errcode='23503',message='COMPARISON_OWNER_MISMATCH'; end if;
  if new.accepted_payload is distinct from proposal.payload then
    raise exception using errcode='23514',message='ACCEPTED_PAYLOAD_MISMATCH';
  end if;
  return new;
end;
$$;
revoke all on function public.cs_guard_plan_insert() from public, anon, authenticated;
create trigger plan_insert_guard before insert on public.plans for each row execute function public.cs_guard_plan_insert();
