"use client";
import { useEffect, useRef, useState } from "react";
import { activitySuggestionSchema, type ActivitySuggestion } from "@/contracts/activity-ai";
import { activityRequest } from "@/lib/activity-api";
import { ACTIVITY_LABELS } from "@/lib/activity-input";
import { londonTime } from "@/domain/time";
const questionText = { energy: "Supply or confirm device watts / cycle energy.", duration: "Choose the active duration.", timing: "Review the times and available window.", equipment: "Specify which powered equipment you will use.", attention: "Confirm supervision and availability.", conflict: "Resolve the conflicting instructions.", unsupported: "This request includes something outside the supported planner." };
export function ActivityAssistant({ onApply, multiple = false }: { onApply(value: ActivitySuggestion): void; multiple?: boolean }) {
  const [text, setText] = useState(""), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [result, setResult] = useState<ActivitySuggestion | null>(null);
  const revision = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { revision.current++; pending.current?.abort(); }, []);
  function invalidate() { revision.current++; pending.current?.abort(); setResult(null); setBusy(false); }
  async function interpret() {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const current = ++revision.current; setBusy(true); setError(null); setResult(null);
    try {
      const answer = await activityRequest("/activities/interpret", activitySuggestionSchema, { schemaVersion: 2, text, referenceDate: londonTime(new Date().toISOString().replace(/\.\d{3}Z$/, "Z")).date, aiConsent: consent }, { taskKey: crypto.randomUUID(), signal: controller.signal });
      if (current === revision.current) setResult(answer);
    } catch (e) { if (current === revision.current) setError(e instanceof Error ? e.message : "Assistance is unavailable. Continue with the fields below."); }
    finally { if (current === revision.current) setBusy(false); }
  }
  return <details className="activity-assistant"><summary>Describe your {multiple ? "tasks" : "activity"} in your own words <span>Optional assistance</span></summary><div className="assistant-content"><p className="field-hint">Include device power or cycle energy if you know it. Suggestions are experimental and need your review; you can always use the fields below.</p><label htmlFor="activity-description">Your description</label><textarea id="activity-description" rows={3} maxLength={2000} value={text} onChange={(e) => { invalidate(); setText(e.target.value); setError(null); }} /><label className="check-label"><input type="checkbox" checked={consent} onChange={(e) => { invalidate(); setConsent(e.target.checked); }} /><span>Send this description to the configured AI provider. I have left out personal information.</span></label><button className="button secondary" type="button" disabled={busy || !consent || !text.trim()} onClick={() => void interpret()}>{busy ? "Reading your description…" : "Suggest editable fields"}</button>{error ? <p className="notice error-notice" role="alert">{error}</p> : null}{result ? <div className="suggestion-list"><h3>Review these suggestions</h3>{result.tasks.map((task, index) => <div className="suggestion-item" key={index}><strong>{ACTIVITY_LABELS[task.category]}</strong><p>{task.durationMinutes === null ? "Duration needed" : `${task.durationMinutes} minutes`} · {task.energyText ?? "Energy needed"}</p>{task.questions.length ? <ul>{task.questions.map((q) => <li key={q}>{questionText[q]}</li>)}</ul> : null}{!multiple ? <button className="text-button" type="button" onClick={() => onApply({ schemaVersion: 2, tasks: [task] })}>Review this activity in the form</button> : null}</div>)}{multiple ? <button className="button secondary" type="button" onClick={() => onApply(result)}>Review these tasks in the planner</button> : null}</div> : null}</div></details>;
}
