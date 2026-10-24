"use client";
import { useRouter } from "next/navigation";
import { HANDOFF_KEY } from "@/lib/schedule-input";
import { useEffect, useRef, useState } from "react";
import { ActivityEditor } from "./activity-editor";
import { ActivityAssistant } from "./activity-assistant";
import { SimulationResult } from "./simulation-result";
import { DateTimeField } from "@/components/planner/date-time-field";
import { emptyActivity, compileActivity, draftFromSuggestion, type ActivityDraft } from "@/lib/activity-input";
import { activityRequest } from "@/lib/activity-api";
import { simulationDocumentSchema, type SimulationDocument, type SimulationRequest } from "@/contracts/activities";
import type { ReferenceProfileV2 } from "@/domain/activities/schemas";
import { londonTime, resolveLondonTime } from "@/domain/time";
import type { LocalTimeInput } from "@/lib/task-input";
import { resolveActivity } from "@/domain/activities/energy";
import { estimateActivity } from "@/domain/activities/carbon";
import { assertForecastFreshness } from "@/domain/grid";

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export function Simulator({ profiles, nowUtc, aiAvailable, ownerTag }: { ownerTag: string; profiles: ReferenceProfileV2[]; nowUtc: string; aiAvailable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => emptyActivity());
  const [start, setStart] = useState<LocalTimeInput>(() => { const local = londonTime(nowUtc); return { date: local.date, time: local.time, offsetChoice: null }; });
  const [result, setResult] = useState<SimulationDocument | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(nowUtc);
  const revision = useRef(0), pending = useRef<AbortController | null>(null), latestRequest = useRef<SimulationRequest | null>(null);
  const perform = useRef<(request: SimulationRequest) => Promise<void>>(async () => {});
  useEffect(() => {
    const sequence = revision;
    const timer = setInterval(() => { if (document.visibilityState === "visible") { setClock(now()); if (latestRequest.current) void perform.current(latestRequest.current); } }, 300_000);
    const resume = () => { if (document.visibilityState === "visible") setClock(now()); };
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", resume); sequence.current++; pending.current?.abort(); };
  }, []);
  function invalidate() { revision.current++; pending.current?.abort(); latestRequest.current = null; setBusy(false); setError(null); setClock(now()); }
  function updateDraft(value: ActivityDraft) { invalidate(); setDraft(value); }
  function requestInput(): SimulationRequest { return { schemaVersion: 2, activity: compileActivity(draft, profiles), startUtc: resolveLondonTime(start) }; }
  async function fetchEstimate(request: SimulationRequest) {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const current = ++revision.current; setBusy(true); setError(null);
    try {
      const answer = await activityRequest("/activities/simulate", simulationDocumentSchema, request, { signal: controller.signal });
      if (current === revision.current) { setResult(answer); setClock(now()); latestRequest.current = request; }
    } catch (e) { if (current === revision.current) { setResult(null); setError(e instanceof Error ? e.message : "The estimate could not be loaded. Your inputs are preserved."); } }
    finally { if (current === revision.current) setBusy(false); }
  }
  useEffect(() => { perform.current = fetchEstimate; });
  async function calculate() { try { await fetchEstimate(requestInput()); } catch (e) { setError(e instanceof Error ? e.message : "Check the fields before calculating."); } }
  let displayed: SimulationDocument | null = null, localPreview = false;
  if (result) {
    try {
      const request = requestInput();
      if (result.estimate.factorKind === "forecast" && result.grid) assertForecastFreshness(result.grid.snapshot, clock);
      const activity = resolveActivity(request.activity, profiles), estimate = estimateActivity(activity, request.startUtc, result.grid?.snapshot ?? null, result.estimate.factorKind);
      const crossesNow = (estimate.endUtc <= clock) !== (result.estimate.factorKind === "actual");
      if (!crossesNow) { displayed = { ...result, activity, estimate, message: estimate.status === "incomplete_grid" ? "The loaded data does not cover this activity completely. Update the estimate to fetch this time period." : result.message }; localPreview = JSON.stringify(activity.input) !== JSON.stringify(result.activity.input) || estimate.startUtc !== result.estimate.startUtc; }
    } catch { /* Incomplete or unconfirmed edits must not retain an old result. */ }
  }
  return <div className="simulation-layout"><section className="activity-workspace"><div className="section-heading"><span className="step-label">01 / Your activity</span><h2>What are you using?</h2><p>Start with a device, its operating time and an energy basis you can check.</p></div>{aiAvailable ? <ActivityAssistant onApply={(value) => { updateDraft(draftFromSuggestion(value.tasks[0]!, draft.id)); const local = value.tasks[0]!.baselineLocal; if (local) setStart({ date: local.slice(0, 10), time: local.slice(11), offsetChoice: null }); }} /> : null}
    <form onSubmit={(event) => { event.preventDefault(); void calculate(); }}><ActivityEditor value={draft} profiles={profiles} onChange={updateDraft} /><DateTimeField id="simulate-start" label="When does it start?" value={start} onChange={(value) => { invalidate(); setStart(value); }} /><p className="field-hint">Choose a start within the current forecast, ending in the next 48 hours, or a completed activity within the last four days.</p>{error ? <p className="notice error-notice" role="alert">{error}</p> : null}<button className="button" type="submit" disabled={busy}>{busy ? "Fetching grid data…" : result ? "Update estimate" : "Calculate estimate"}</button></form></section><div className="simulation-output" aria-live="polite" aria-busy={busy}>{displayed ? <><SimulationResult result={displayed} localPreview={localPreview} /><button className="button secondary" onClick={() => { try { const input = requestInput(); sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...input, ownerTag, expiresAt: Date.now() + 30 * 60 * 1000 })); router.push("/app/plan/new?from=simulator"); } catch { setError("Your browser could not carry this activity across. Open the planner and enter it manually."); } }}>Use this activity in a plan</button></> : <section className="simulation-empty"><span className="step-label">02 / Your estimate</span><h2>Understand the electricity behind your routine.</h2><p>Your estimate will show electricity, grid CO₂ and a breakdown across time. It uses your energy inputs and the applicable Great Britain grid factors.</p><ol><li>Choose an activity and active duration.</li><li>Check device watts, cycle energy or an exact reference.</li><li>Set the time and calculate.</li></ol><p className="field-hint">Changing an unconfirmed input hides the previous result. Estimates describe a scenario; they do not measure your device.</p></section>}</div></div>;
}
