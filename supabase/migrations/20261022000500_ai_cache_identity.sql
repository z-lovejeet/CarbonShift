-- Cached answers still bind command identity, but never charge AI quotas or acquire provider leases.
create function public.cs_ai_cache_key(p_owner uuid,p_actor text,p_key uuid,p_fingerprint text,p_policy text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare task public.ai_tasks; task_id uuid:=gen_random_uuid(); bound_fingerprint text; t timestamptz:=clock_timestamp();
begin
  perform pg_advisory_xact_lock(216220003);
  if p_owner is null or p_key is null or p_fingerprint is null or p_policy is null or not(p_fingerprint ~ '^[0-9a-f]{64}$') or not(p_policy ~ '^[0-9a-f]{64}$') then raise exception 'INVALID_ADMISSION'; end if;
  perform public.cs_ai_prune();
  select * into task from public.ai_tasks where actor_hash=p_actor and role='explanation' and client_key=p_key;
  if found then
    bound_fingerprint:=encode(sha256(convert_to(p_fingerprint||':'||task.policy_digest,'UTF8')),'hex');
    if task.fingerprint<>bound_fingerprint or task.owner_id is distinct from p_owner then return jsonb_build_object('code','AI_TASK_CONFLICT'); end if;
    return jsonb_build_object('id',task.id);
  end if;
  bound_fingerprint:=encode(sha256(convert_to(p_fingerprint||':'||p_policy,'UTF8')),'hex');
  insert into public.ai_tasks(id,owner_id,actor_hash,role,client_key,fingerprint,policy_digest,state,deadline,finished_at)
    values(task_id,p_owner,p_actor,'explanation',p_key,bound_fingerprint,p_policy,'succeeded',t,t);
  return jsonb_build_object('id',task_id);
end $$;
revoke all on function public.cs_ai_cache_key(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cs_ai_cache_key(uuid,text,uuid,text,text) to service_role;
