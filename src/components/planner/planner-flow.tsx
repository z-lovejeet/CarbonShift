"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ComparisonRequest, ComparisonView, Plan } from "@/contracts/planning";
import { initialTaskDraft, type TaskDraft } from "@/lib/task-input";
import { PlanningFailure } from "@/lib/planning-api";
import { londonLabel } from "@/lib/presentation";
import { TaskForm } from "./task-form";
import { ConstraintReview } from "./constraint-review";
import { ErrorNotice } from "./error-notice";
import { ForecastView } from "./forecast-view";
import { TimingAssistant } from "./timing-assistant";
import { ExplanationPanel } from "./explanation-panel";
import { aiApi } from "@/lib/ai-api";
import { londonTime } from "@/domain/time";

type Props = { nowUtc: string; initialDraft?: TaskDraft; compare: (request: ComparisonRequest) => Promise<ComparisonView> } & ({ mode: "live"; aiAvailable?: boolean; save: (id: string, version: number, key: string) => Promise<Plan>; onSaved: (plan: Plan) => void } | { mode: "demo" });
export function PlannerFlow(props: Props) {
  const [draft, setDraft] = useState(() => props.initialDraft ?? initialTaskDraft(props.nowUtc));
  const [stage, setStage] = useState<"form" | "review" | "compare" | "save" | "demo-preview" | "saved">("form");
  const [input, setInput] = useState<ComparisonRequest | null>(null), [view, setView] = useState<ComparisonView | null>(null);
  const [confirmed, setConfirmed] = useState(false), [saveConfirmed, setSaveConfirmed] = useState(false);
  const [pending, setPending] = useState(false), [error, setError] = useState<Error | null>(null), [clock, setClock] = useState(props.nowUtc);
  const [attemptedSave, setAttemptedSave] = useState(false), [definitivelyExpired, setDefinitivelyExpired] = useState(false), [saved, setSaved] = useState<Plan | null>(null);
  const clockReference = useRef({ serverMs: Date.parse(props.nowUtc), monotonicMs: null as number | null });
  const busy = useRef(false), retryKey = useRef<string | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const now = () => props.mode === "demo" ? props.nowUtc : new Date(clockReference.current.serverMs + Math.max(0, performance.now() - (clockReference.current.monotonicMs ?? performance.now()))).toISOString().replace(/\.\d{3}Z$/, "Z");
  useEffect(() => { if (props.mode === "demo") return; clockReference.current.monotonicMs ??= performance.now(); const timer = setInterval(() => setClock(new Date(clockReference.current.serverMs + Math.max(0, performance.now() - (clockReference.current.monotonicMs ?? performance.now()))).toISOString().replace(/\.\d{3}Z$/, "Z")), 1000); return () => clearInterval(timer); }, [props.mode]);
  useEffect(() => { heading.current?.focus(); }, [stage]);
  const expired = props.mode === "live" && view !== null && (clock >= view.comparison.expiresAtUtc || definitivelyExpired);
  async function compare() {
    if (!input || !confirmed || busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { const result = await props.compare(input); setView(result); setAttemptedSave(false); setDefinitivelyExpired(false); retryKey.current = null; setSaveConfirmed(false); clockReference.current = { serverMs: Date.parse(result.comparison.createdAtUtc), monotonicMs: performance.now() }; setClock(result.comparison.createdAtUtc); setStage("compare"); }
    catch (failure) { setError(failure instanceof PlanningFailure ? failure : new PlanningFailure("SERVICE_UNAVAILABLE")); }
    finally { busy.current = false; setPending(false); }
  }
  async function save() {
    if (!view || !saveConfirmed || busy.current || (expired && (!attemptedSave || definitivelyExpired))) return;
    if (props.mode === "demo") { setStage("demo-preview"); return; }
    busy.current = true; setPending(true); setError(null); setAttemptedSave(true);
    retryKey.current ??= crypto.randomUUID();
    try {
      const plan = await props.save(view.comparison.id, view.comparison.version, retryKey.current);
      const { id, schemaVersion: _schema, version: _version, ...reviewed } = view.comparison;
      void _schema; void _version;
      if (plan.comparisonId !== id || JSON.stringify(plan.comparison) !== JSON.stringify(reviewed) || JSON.stringify(plan.forecastSnapshot) !== JSON.stringify(view.forecastSnapshot)) throw new PlanningFailure("INVALID_RESPONSE");
      setSaved(plan); setStage("saved"); props.onSaved(plan);
    }
    catch (failure) {
      const issue = failure instanceof PlanningFailure ? failure : new PlanningFailure("SERVICE_UNAVAILABLE");
      setError(issue);
      if (["COMPARISON_EXPIRED", "VERSION_CONFLICT"].includes(issue.code)) setDefinitivelyExpired(true);
    } finally { busy.current = false; setPending(false); }
  }
  function edit() { setError(null); setConfirmed(false); setSaveConfirmed(false); setStage("form"); }
  const step = stage === "form" || stage === "review" ? 1 : stage === "compare" ? 2 : 3;
  return <div className="planner-width">
    {props.mode === "demo" ? <div className="demo-banner"><strong>Illustrative example</strong><p>Synthetic grid factors · fixed example dates · no account, live save, appliance operation or chain transaction.</p><button type="button" className="text-button" disabled={pending} onClick={() => { setDraft(props.initialDraft ?? initialTaskDraft(props.nowUtc)); setInput(null); setView(null); setError(null); setConfirmed(false); setSaveConfirmed(false); setStage("form"); }}>Reset example</button></div> : null}
    <ol className="step-indicator" aria-label="Planning steps">{["Task", "Compare", "Save"].map((label, i) => <li key={label} aria-current={step === i + 1 ? "step" : undefined}>{i + 1} · {label}</li>)}</ol>
    <h2 className="stage-title" ref={heading} tabIndex={-1}>{stage === "form" ? "Make room for your wash." : stage === "review" ? "Review your constraints." : stage === "compare" ? "Find the time that fits." : stage === "save" ? "Keep this exact comparison." : stage === "demo-preview" ? "Your example plan preview." : "Your private plan is saved."}</h2>
    {error ? <ErrorNotice error={error} /> : null}
    {stage === "form" && props.mode === "live" ? <TimingAssistant available={props.aiAvailable ?? false} draft={draft} onApply={setDraft} referenceDate={() => londonTime(now()).date} interpret={aiApi.constraints} /> : null}
    {stage === "form" ? <TaskForm draft={draft} onChange={setDraft} nowUtc={now} onReview={(request) => { setInput(request); setConfirmed(false); setError(null); setStage("review"); }} /> : null}
    {stage === "review" && input ? <><ConstraintReview input={input} /><p className="muted">All scheduling times are Europe/London. Changing these fields will require another review.</p><label className="check-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} />I confirm the duration, energy estimate, time window and baseline choice.</label><div className="stage-actions"><button type="button" className="button" onClick={compare} disabled={!confirmed || pending}>{pending ? "Comparing times…" : "Compare times"}</button><button type="button" className="text-button" disabled={pending} onClick={edit}>Edit constraints</button></div>{pending ? <p role="status" className="field-hint">{props.mode === "demo" ? "Calculating the example." : "Reading and checking the grid forecast. Your fields are kept here."}</p> : null}</> : null}
    {(stage === "compare" || stage === "save" || stage === "demo-preview") && view ? <>
      {expired ? <p className="notice" role="status">This comparison has expired. {attemptedSave && !definitivelyExpired ? "If your previous save was interrupted, retry it to check whether it was saved." : "Compare again and review the new result before saving."}</p> : null}
      {stage === "save" ? <><p className="muted">This saves the exact baseline, suggested time, energy assumption and forecast shown below. It does not start your appliance or publish anything.</p><p className="field-hint">{props.mode === "demo" ? "Example only — nothing will be saved to an account." : `Review before ${londonLabel(view.comparison.expiresAtUtc)}. The server checks expiry again when you save.`}</p></> : null}
      {stage === "demo-preview" ? <p className="notice">This is a local preview only. Nothing was saved or published. <Link href="/app/plan/new">Plan a real wash</Link> when you’re ready.</p> : null}
      <ForecastView comparison={view.comparison} snapshot={view.forecastSnapshot} demo={props.mode === "demo"} />
      {stage === "compare" ? <ExplanationPanel key={view.comparison.id} comparison={view.comparison} request={props.mode === "live" && props.aiAvailable ? aiApi.explanation : undefined} /> : null}
      {stage === "compare" ? <div className="stage-actions"><button type="button" className="button" disabled={expired && (!attemptedSave || definitivelyExpired)} onClick={() => { setStage("save"); setError(null); }}>{expired && attemptedSave && !definitivelyExpired ? "Check this save" : "Review this plan"}</button><button type="button" className="text-button" onClick={edit}>Edit constraints</button></div> : null}
      {stage === "save" ? <><label className="check-label"><input type="checkbox" checked={saveConfirmed} onChange={(event) => setSaveConfirmed(event.target.checked)} disabled={pending} />I’ve reviewed the exact baseline and suggested times, the assumed energy, and the forecast limits.</label><div className="stage-actions"><button type="button" className="button" disabled={!saveConfirmed || pending || (expired && (!attemptedSave || definitivelyExpired))} onClick={save}>{pending ? "Confirming your save…" : props.mode === "demo" ? "Preview example plan" : attemptedSave ? "Retry the same save" : "Save this plan"}</button><button type="button" className="text-button" disabled={pending} onClick={() => { setStage("compare"); setError(null); }}>Back to comparison</button></div>{attemptedSave ? <p className="field-hint">Retries use the same request key. You can also <Link href="/app" target="_blank" rel="noreferrer">check your plans in another tab</Link> before trying again.</p> : null}</> : null}
      {expired ? <button type="button" className="button secondary" disabled={pending} onClick={() => { setStage("review"); setConfirmed(false); setSaveConfirmed(false); setError(null); }}>Compare again</button> : null}
    </> : null}
    {stage === "saved" && saved ? <p role="status">Saved privately. <Link href={`/app/plans/${saved.id}`}>Open your saved plan</Link>.</p> : null}
  </div>;
}
