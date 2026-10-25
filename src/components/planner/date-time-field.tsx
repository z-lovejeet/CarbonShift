"use client";
import { useEffect, useRef } from "react";
import { today } from "@internationalized/date";
import { ambiguousLocal, type LocalTimeInput } from "@/lib/task-input";
import { DatePickerInput, TimePickerInput } from "./date-time-pickers";

export function DateTimeField({ id, label, value, onChange, error, minDate, maxDate }: { id: string; label: string; value: LocalTimeInput; onChange: (next: LocalTimeInput) => void; error?: string; minDate?: string; maxDate?: string }) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!value.date) onChange({ ...value, date: today("Europe/London").toString() });
  }, [value, onChange]);
  const ambiguous = ambiguousLocal(value);
  const hint = `${id}-hint`, issue = error ? `${id}-error` : undefined;
  return <fieldset className="date-time-field" id={`${id}-group`}>
    <legend>{label}</legend>
    <div className="date-time-inputs">
      <div><label className="field-label" htmlFor={`${id}-date`}>Date</label><DatePickerInput id={`${id}-date`} label={`${label.toLowerCase()} date`} minDate={minDate} maxDate={maxDate} value={value.date} onChange={(date) => onChange({ ...value, date, offsetChoice: null })} invalid={Boolean(error)} describedBy={[hint, issue].filter(Boolean).join(" ")} /></div>
      <div><label className="field-label" htmlFor={`${id}-time`}>Time</label><TimePickerInput id={`${id}-time`} label={`${label.toLowerCase()} time`} value={value.time} onChange={(time) => onChange({ ...value, time, offsetChoice: null })} invalid={Boolean(error)} describedBy={[hint, issue].filter(Boolean).join(" ")} /></div>
    </div>
    <p id={hint} className="field-hint">Europe/London · 24-hour time{ambiguous ? " — this time occurs twice when the clocks go back." : "."}</p>
    {ambiguous ? <div className="offset-choice"><label htmlFor={`${id}-offset`}>Which occurrence?</label><select id={`${id}-offset`} value={value.offsetChoice ?? ""} onChange={(event) => onChange({ ...value, offsetChoice: event.target.value ? event.target.value as "earlier" | "later" : null })} aria-describedby={issue}><option value="">Choose an occurrence</option><option value="earlier">First — BST (UTC+01:00)</option><option value="later">Second — GMT (UTC+00:00)</option></select></div> : null}
    {error ? <p id={issue} className="field-error">{error}</p> : null}
  </fieldset>;
}
