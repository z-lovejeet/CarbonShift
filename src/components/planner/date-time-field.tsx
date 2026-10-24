"use client";
import { ambiguousLocal, type LocalTimeInput } from "@/lib/task-input";

export function DateTimeField({ id, label, value, onChange, error, minDate, maxDate }: { id: string; label: string; value: LocalTimeInput; onChange: (next: LocalTimeInput) => void; error?: string; minDate?: string; maxDate?: string }) {
  const ambiguous = ambiguousLocal(value);
  const hint = `${id}-hint`, issue = error ? `${id}-error` : undefined;
  return <fieldset className="date-time-field" id={`${id}-group`}>
    <legend>{label}</legend>
    <div className="date-time-inputs">
      <div><label className="field-label" htmlFor={`${id}-date`}>Date</label><input id={`${id}-date`} type="date" min={minDate} max={maxDate} value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value, offsetChoice: null })} aria-invalid={Boolean(error)} aria-describedby={[hint, issue].filter(Boolean).join(" ")} /></div>
      <div><label className="field-label" htmlFor={`${id}-time`}>Time</label><input id={`${id}-time`} type="time" step="60" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value, offsetChoice: null })} aria-invalid={Boolean(error)} aria-describedby={[hint, issue].filter(Boolean).join(" ")} /></div>
    </div>
    <p id={hint} className="field-hint">Europe/London time{ambiguous ? " — this time occurs twice when the clocks go back." : "."}</p>
    {ambiguous ? <div className="offset-choice"><label htmlFor={`${id}-offset`}>Which occurrence?</label><select id={`${id}-offset`} value={value.offsetChoice ?? ""} onChange={(event) => onChange({ ...value, offsetChoice: event.target.value ? event.target.value as "earlier" | "later" : null })} aria-describedby={issue}><option value="">Choose an occurrence</option><option value="earlier">First — BST (UTC+01:00)</option><option value="later">Second — GMT (UTC+00:00)</option></select></div> : null}
    {error ? <p id={issue} className="field-error">{error}</p> : null}
  </fieldset>;
}
