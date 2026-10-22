"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/contracts/planning";
import { lifecycleAckSchema } from "@/contracts/lifecycle";
import { londonTime, resolveLondonTime } from "@/domain/time";
import { DateTimeField } from "@/components/planner/date-time-field";
import { ErrorNotice } from "@/components/planner/error-notice";
import { readPlanningApi } from "@/lib/planning-api";
import { londonLabel } from "@/lib/presentation";
import type { LocalTimeInput } from "@/lib/task-input";

export function CompletionForm({ plan }: { plan: Plan }) {
  const router = useRouter(), pending = useRef(false), retry = useRef<{ identity: string; key: string } | null>(null);
  const initial = londonTime(plan.latestReport?.reportedStartUtc ?? plan.comparison.selected.startUtc);
  const [kind, setKind] = useState<"ran" | "did_not_run">(plan.latestReport?.kind ?? "ran");
  const [start, setStart] = useState<LocalTimeInput>({ date: initial.date, time: initial.time, offsetChoice: plan.latestReport?.reportedStartUtc ? initial.offset === "+01:00" ? "earlier" : "later" : null });
  const [profile, setProfile] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current) return; setError(null);
    let reportedStartUtc: string | null = null;
    try { if (kind === "ran") reportedStartUtc = resolveLondonTime(start); } catch (failure) { setError(failure as Error); return; }
    if (kind === "ran" && !profile) { setError(new Error("Confirm whether the original duration and energy assumption still apply.")); return; }
    const input = { kind, reportedStartUtc, profileStillApplicable: kind === "ran" ? profile === "yes" : null, correctsReportId: plan.latestReport?.id ?? null, reason: reason.trim() };
    const identity = JSON.stringify(input); if (retry.current?.identity !== identity) retry.current = { identity, key: crypto.randomUUID() };
    pending.current = true; setBusy(true);
    try { await readPlanningApi(`/plans/${plan.id}/reports`, lifecycleAckSchema, input, retry.current.key); retry.current = null; router.replace(`/app/plans/${plan.id}`); router.refresh(); }
    catch (failure) { setError(failure as Error); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form className="task-form completion-form" onSubmit={submit}>
    <div className="saved-notice"><strong>Original selected start · {londonLabel(plan.comparison.selected.startUtc)}</strong><p>{plan.comparison.constraints.durationMinutes} minutes · {(plan.comparison.constraints.energyWh / 1000).toFixed(3)} kWh assumed. Your original forecast stays unchanged.</p></div>
    <fieldset disabled={busy} className="completion-fields"><legend>What happened?</legend><div className="choice-row"><label><input type="radio" name="kind" checked={kind === "ran"} onChange={() => setKind("ran")} /> I ran the wash</label><label><input type="radio" name="kind" checked={kind === "did_not_run"} onChange={() => setKind("did_not_run")} /> I did not run it</label></div>
      {kind === "ran" ? <><DateTimeField id="reported-start" label="When did it actually start?" value={start} onChange={setStart} /><label htmlFor="profile-confirmation">Do the saved duration and energy assumption still apply?</label><select required id="profile-confirmation" value={profile} onChange={(event) => setProfile(event.target.value)}><option value="">Choose an answer</option><option value="yes">Yes, both still apply</option><option value="no">No, the cycle or assumptions changed</option></select><p className="field-hint">A changed profile is kept in history without an updated emissions calculation. Report a run only after its full saved duration has ended.</p></> : <p className="notice">Report non-execution after the planned finish. Before the selected start, use cancellation on your plan instead. Non-execution has no emissions benefit.</p>}
      <label htmlFor="report-reason">{plan.latestReport ? "Reason for this correction" : "Note (optional)"}</label><textarea id="report-reason" value={reason} required={Boolean(plan.latestReport)} maxLength={500} rows={3} onChange={(event) => setReason(event.target.value)} /><p className="field-hint">Corrections append a new report. Earlier versions remain in your private history.</p>
    </fieldset>
    {error ? <ErrorNotice error={error} /> : null}<p className="field-hint">Self-reported execution, assumed energy and national average grid estimates. No appliance measurement or verification.</p><button type="submit" className="button" disabled={busy}>{busy ? "Saving your report…" : plan.latestReport ? "Save correction" : "Save execution report"}</button>
  </form>;
}
