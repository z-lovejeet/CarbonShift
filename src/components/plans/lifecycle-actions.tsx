"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Plan } from "@/contracts/planning";
import { lifecycleAckSchema } from "@/contracts/lifecycle";
import { readPlanningApi } from "@/lib/planning-api";
import { ErrorNotice } from "@/components/planner/error-notice";

export function LifecycleActions({ plan, nowUtc }: { plan: Plan; nowUtc: string }) {
  const router = useRouter(), pending = useRef(false), retry = useRef<{ identity: string; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<Error | null>(null), [notice, setNotice] = useState("");
  const [cancelReason, setCancelReason] = useState(""), [confirmDelete, setConfirmDelete] = useState(false);
  async function act(action: "cancel" | "refresh" | "delete") {
    if (pending.current) return;
    const body = action === "cancel" ? { reason: cancelReason.trim() } : action === "refresh" ? { expectedResultRevision: plan.latestResult?.sequence } : undefined;
    const identity = JSON.stringify({ action, body });
    if (retry.current?.identity !== identity) retry.current = { identity, key: crypto.randomUUID() };
    pending.current = true; setBusy(action); setError(null); setNotice("");
    try {
      const path = `/plans/${plan.id}${action === "cancel" ? "/cancel" : action === "refresh" ? "/results/refresh" : ""}`;
      const ack = await readPlanningApi(path, lifecycleAckSchema, body, retry.current.key, action === "delete" ? "DELETE" : undefined);
      retry.current = null;
      if (ack.deleted) { router.replace("/app"); router.refresh(); return; }
      setNotice(ack.changed ? "Your history has been updated." : "No relevant grid readings changed. Your current result is unchanged."); router.refresh();
    } catch (failure) { setError(failure as Error); }
    finally { pending.current = false; setBusy(null); }
  }
  return <section className="lifecycle-actions" aria-labelledby="plan-actions"><h2 id="plan-actions">Your next step</h2>
    {plan.status === "cancelled" ? <p>This plan was cancelled before its selected start. Create a new plan if you decide to run a wash.</p> : <>
      <p>Use your appliance yourself, following its instructions. Report what happened after the cycle finishes.</p>
      <div className="action-row"><Link className="button" href={`/app/plans/${plan.id}/complete`}>{plan.latestReport ? "Correct your report" : "Report execution"}</Link>
        {plan.latestReport?.kind === "ran" && plan.latestResult?.result.status !== "outside_supported_window" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("refresh")}>{busy === "refresh" ? "Checking grid data…" : "Refresh updated estimate"}</button> : null}</div>
      {!plan.latestReport && nowUtc < plan.comparison.selected.startUtc ? <details className="source-details"><summary>Cancel this plan</summary><p>Cancel before the selected start if you no longer intend to run this wash. Cancellation records non-execution and has no emissions benefit.</p><label className="field-label" htmlFor="cancel-reason">Why are you cancelling?</label><input id="cancel-reason" value={cancelReason} maxLength={500} onChange={(event) => setCancelReason(event.target.value)} /><button className="button secondary" disabled={Boolean(busy) || !cancelReason.trim()} onClick={() => act("cancel")}>{busy === "cancel" ? "Cancelling…" : "Confirm cancellation"}</button></details> : null}
    </>}
    {notice ? <p className="notice" role="status">{notice}</p> : null}{error ? <ErrorNotice error={error} /> : null}
    {plan.publication === "private" ? <details className="source-details"><summary>Delete this private plan</summary><p>This removes its private reports, results and saved forecast. First <Link href="/app/settings">confirm your identity in Account settings</Link>, then return here within ten minutes.</p><label className="checkbox-row"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />I understand this private history will be removed.</label><button className="button danger" disabled={Boolean(busy) || !confirmDelete} onClick={() => act("delete")}>{busy === "delete" ? "Deleting…" : "Delete private plan"}</button></details> : <p className="field-hint">This plan has a consented public copy. <Link href="/app/settings">Account deletion</Link> removes private data and account links while retaining the disclosed proof. Signed transactions may still confirm after cancellation or deletion.</p>}
  </section>;
}
