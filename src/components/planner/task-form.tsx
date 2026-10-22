"use client";
import { useState, type FormEvent } from "react";
import { METHOD } from "@/domain/method";
import { buildTaskInput, type InputIssues, type TaskDraft } from "@/lib/task-input";
import type { ComparisonRequest } from "@/contracts/planning";
import { DateTimeField } from "./date-time-field";

export function TaskForm({ draft, onChange, nowUtc, onReview }: { draft: TaskDraft; onChange: (next: TaskDraft) => void; nowUtc: () => string; onReview: (request: ComparisonRequest) => void }) {
  const [errors, setErrors] = useState<InputIssues>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = buildTaskInput(draft, nowUtc());
    if (result.errors) { setErrors(result.errors); requestAnimationFrame(() => document.getElementById("input-errors")?.focus()); }
    else { setErrors({}); onReview(result.data); }
  }
  const change = (next: Partial<TaskDraft>) => { onChange({ ...draft, ...next }); setErrors({}); };
  return <form onSubmit={submit} noValidate className="task-form">
    {Object.keys(errors).length ? <div className="notice error-notice" role="alert" id="input-errors" tabIndex={-1}><h2>Check these details</h2><ul>{Object.entries(errors).map(([key, message]) => <li key={key}><a href={key === "energy" ? "#energy" : key === "duration" ? "#duration" : ["earliest", "deadline", "baseline"].includes(key) || key.startsWith("block-") ? `#${key}-date` : "#task-window"}>{message}</a></li>)}</ul></div> : null}
    <section className="form-section" aria-labelledby="cycle-title"><div className="section-number" aria-hidden="true">01</div><div className="form-section-content"><h2 id="cycle-title">Your washing cycle</h2><p className="section-description">One uninterrupted cycle. You’ll operate your appliance yourself.</p>
      <div className="input-pair"><div><label htmlFor="duration">Cycle duration</label><select id="duration" value={draft.durationMinutes} onChange={(event) => change({ durationMinutes: event.target.value })} aria-describedby="duration-hint">{METHOD.durationsMinutes.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select><p className="field-hint" id="duration-hint">30–180 minutes, in half-hour steps.</p></div>
      <div><label htmlFor="energy">Estimated cycle energy (kWh)</label><input id="energy" inputMode="decimal" type="text" value={draft.energyKwh} onChange={(event) => change({ energyKwh: event.target.value })} aria-invalid={Boolean(errors.energy)} aria-describedby="energy-hint" autoComplete="off" /><p className="field-hint" id="energy-hint">0.05–5 kWh. Up to three decimals. Use appliance information if available.</p></div></div>
      <label htmlFor="energy-basis">Where is this estimate from?</label><select id="energy-basis" value={draft.energyBasis} onChange={(event) => change({ energyBasis: event.target.value as TaskDraft["energyBasis"] })}><option value="user_estimate">My own estimate / appliance information</option><option value="illustrative_default">An illustrative assumption</option></select><p className="field-hint">Energy is assumed, even when taken from appliance information. We don’t measure it.</p>
    </div></section>
    <section className="form-section" aria-labelledby="task-window" id="window-section"><div className="section-number" aria-hidden="true">02</div><div className="form-section-content"><h2 id="task-window" tabIndex={-1}>A window that works for you</h2><p className="section-description">All dates and times use Europe/London, wherever you are. Finish within the next 48 elapsed hours.</p>
      <DateTimeField id="earliest" label="Earliest start" value={draft.earliest} onChange={(value) => change({ earliest: value })} error={errors.earliest} />
      <DateTimeField id="deadline" label="Finish deadline" value={draft.deadline} onChange={(value) => change({ deadline: value })} error={errors.deadline} />
      <label htmlFor="baseline-kind">When would you otherwise run it?</label><select id="baseline-kind" value={draft.baselineKind} onChange={(event) => change({ baselineKind: event.target.value as TaskDraft["baselineKind"] })}><option value="earliest_feasible">First available start (default)</option><option value="user_selected">I’ll choose my usual start</option></select><p className="field-hint">We compare against this baseline. You’ll review the exact baseline before saving.</p>
      {draft.baselineKind === "user_selected" ? <DateTimeField id="baseline" label="Your usual start" value={draft.baseline} onChange={(value) => change({ baseline: value })} error={errors.baseline} /> : null}
    </div></section>
    <section className="form-section" aria-labelledby="blocks-title"><div className="section-number" aria-hidden="true">03</div><div className="form-section-content"><h2 id="blocks-title">Times that don’t work</h2><p className="section-description">Optional: up to four blocked periods inside your window. A wash must fit entirely outside them.</p>
      {draft.blocks.map((block, i) => <div className="blocked-period" key={i}><h3>Blocked period {i + 1}</h3><DateTimeField id={`block-${i}-start`} label="Blocked from" value={block.start} onChange={(value) => change({ blocks: draft.blocks.map((item, index) => index === i ? { ...item, start: value } : item) })} error={errors[`block-${i}-start`]} /><DateTimeField id={`block-${i}-end`} label="Blocked until" value={block.end} onChange={(value) => change({ blocks: draft.blocks.map((item, index) => index === i ? { ...item, end: value } : item) })} error={errors[`block-${i}-end`]} /><button type="button" className="text-button" onClick={() => { change({ blocks: draft.blocks.filter((_, index) => index !== i) }); requestAnimationFrame(() => document.getElementById("add-block")?.focus()); }}>Remove blocked period {i + 1}</button></div>)}
      <button id="add-block" type="button" className="button secondary" disabled={draft.blocks.length >= METHOD.maximumBlocks} onClick={() => change({ blocks: [...draft.blocks, { start: { date: draft.earliest.date, time: "", offsetChoice: null }, end: { date: draft.deadline.date, time: "", offsetChoice: null } }] })}>Add blocked period</button>{draft.blocks.length >= METHOD.maximumBlocks ? <p className="field-hint">Four periods added. Remove one to add another.</p> : null}
    </div></section>
    <p className="form-disclosure">Great Britain — national estimate. Only choose times consistent with your appliance’s instructions and supervision needs.</p><button className="button" type="submit">Review constraints <span aria-hidden="true">→</span></button>
  </form>;
}
