"use client";
import { useEffect, useRef, useState } from "react";
import type { ConstraintSuggestion } from "@/contracts/ai";
import { AiFailure } from "@/lib/ai-api";
import { applyTimingSuggestion, clarificationCopy } from "@/lib/ai-draft";
import type { TaskDraft } from "@/lib/task-input";

type Props = { available: boolean; draft: TaskDraft; onApply: (draft: TaskDraft) => void; referenceDate: () => string; interpret: (text: string, date: string, key: string) => Promise<ConstraintSuggestion> };
const labels = { earliestLocal: "Earliest start", deadlineLocal: "Finish deadline", baselineLocal: "Usual start", blockedLocal: "Blocked periods", durationMinutes: "Cycle duration" };
export function TimingAssistant({ available, draft, onApply, referenceDate, interpret }: Props) {
  const [text, setText] = useState(""), [consent, setConsent] = useState(false), [checked, setChecked] = useState(false), [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<ConstraintSuggestion | null>(null), [error, setError] = useState<AiFailure | null>(null), [wait, setWait] = useState(0), [applied, setApplied] = useState(false);
  const busy = useRef(false), until = useRef(0);
  useEffect(() => { if (wait <= 0) return; const timer = setInterval(() => setWait(Math.max(0, Math.ceil((until.current - Date.now()) / 1000))), 1000); return () => clearInterval(timer); }, [wait]);
  async function request() {
    if (busy.current || !consent || !text.trim() || wait > 0) return;
    busy.current = true; setPending(true); setError(null); setSuggestion(null); setChecked(false); setApplied(false);
    try { setSuggestion(await interpret(text, referenceDate(), crypto.randomUUID())); }
    catch (failure) { const issue = failure instanceof AiFailure ? failure : new AiFailure("AI_UNAVAILABLE"); setError(issue); if (issue.retryAfterSeconds) { until.current = Date.now() + issue.retryAfterSeconds * 1000; setWait(issue.retryAfterSeconds); } }
    finally { busy.current = false; setPending(false); }
  }
  return <details className="timing-assistant"><summary>Describe your timing <span className="muted">Optional AI · experimental</span></summary>
    <div className="assistant-content">
      {!available ? <p className="muted">Timing assistance is currently unavailable. Enter your timing in the form below.</p> : <>
        <p className="section-description">Write when a wash can run. We’ll suggest fields for you to check. Keep names, addresses and other personal details out of this text.</p>
        <label htmlFor="timing-text">Your timing request</label><textarea id="timing-text" rows={3} maxLength={1000} value={text} disabled={pending} onChange={(event) => { setText(event.target.value); setSuggestion(null); setChecked(false); setApplied(false); }} placeholder="For example: Tomorrow, finish by noon. Avoid 9 to 10." aria-describedby="ai-consent-note" />
        <p className="field-hint" id="ai-consent-note">This text may be processed by Google Gemini or Groq, including during fallback. Free Gemini may use inputs for product improvement and human review. Raw text and suggestions are kept only for this request in CarbonShift; providers have their own data terms.</p>
        <label className="check-label"><input type="checkbox" checked={consent} disabled={pending} onChange={(event) => setConsent(event.target.checked)} />I agree to send this non-personal timing text to the configured AI providers.</label>
        <button className="button secondary" type="button" disabled={!consent || !text.trim() || pending || wait > 0} onClick={request}>{pending ? "Checking your timing…" : error || suggestion ? "Start a new AI request" : "Suggest timing fields"}</button>
        {pending ? <p role="status" className="field-hint">Checking the request. Your manual fields remain available below.</p> : null}
        {error ? <p role="alert" className="notice">{error.message}{wait > 0 ? ` You can request again in ${wait} seconds.` : ""}</p> : null}
        {suggestion ? <section className="suggestion-review" aria-labelledby="suggestion-title"><h3 id="suggestion-title">Check the suggested fields</h3>
          <dl className="suggestion-fields">{(["earliestLocal", "deadlineLocal", "baselineLocal"] as const).map((field) => <div key={field}><dt>{labels[field]}</dt><dd>{[suggestion[field].date, suggestion[field].time, suggestion[field].offsetChoice ? `${suggestion[field].offsetChoice} occurrence` : null].filter(Boolean).join(" · ") || "Not supplied — keep or complete manually"}</dd></div>)}<div><dt>Duration</dt><dd>{suggestion.durationMinutes === null ? "Not supplied — check your manual choice" : `${suggestion.durationMinutes} minutes`}</dd></div>
          {suggestion.blockedLocal.map((b, i) => <div key={i}><dt>Blocked period {i + 1}</dt><dd>{b.startDate ?? "Date needed"} {b.startTime ?? "Time needed"} → {b.endDate ?? "Date needed"} {b.endTime ?? "Time needed"}</dd></div>)}</dl>
          {suggestion.sourceSpans.length ? <details><summary>Supporting text</summary><ul>{suggestion.sourceSpans.map((s, i) => <li key={i}>{labels[s.field]}: <q>{text.slice(s.start, s.end)}</q></li>)}</ul></details> : null}
          {suggestion.questions.length ? <ul className="clarification-list">{suggestion.questions.map((q, i) => <li key={i}><strong>{labels[q.field]}:</strong> {clarificationCopy[q.messageKey]}</li>)}</ul> : null}
          {suggestion.unsupportedRequests.length ? <p className="notice">Part of this request is outside the supported manual washing-cycle planner. Enter supported timing directly in the form.</p> : <>
            <p className="field-hint">Applying replaces the shown timing fields. Missing values keep your existing entries. Check the duration and energy yourself, then review all constraints in the next step.</p>
            <label className="check-label"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />I checked these suggestions against my request.</label>
            <button type="button" className="button secondary" disabled={!checked || applied} onClick={() => { onApply(applyTimingSuggestion(draft, suggestion)); setApplied(true); }}>{applied ? "Added to the form" : "Apply checked suggestions"}</button>
          </>}
          {applied ? <p role="status" className="field-hint">Suggestions added. Complete any unclear fields below and review all constraints.</p> : null}
        </section> : null}
      </>}
    </div>
  </details>;
}
