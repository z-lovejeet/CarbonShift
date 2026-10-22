"use client";
import { useEffect, useRef, useState } from "react";
import type { ComparisonDocument } from "@/contracts/planning";
import type { ExplanationDocument } from "@/contracts/ai";
import { AiFailure } from "@/lib/ai-api";

export function ExplanationPanel({ comparison, request }: { comparison: ComparisonDocument; request?: (id: string, key: string) => Promise<ExplanationDocument> }) {
  const [consent, setConsent] = useState(false), [pending, setPending] = useState(false), [answer, setAnswer] = useState<ExplanationDocument | null>(null), [error, setError] = useState<AiFailure | null>(null);
  const busy = useRef(false), blockedUntil = useRef(0);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const timer = setInterval(() => setWait(Math.max(0, Math.ceil((blockedUntil.current - Date.now()) / 1000))), 1000); return () => clearInterval(timer); }, [wait]);
  async function explain() {
    if (!request || busy.current || !consent || Date.now() < blockedUntil.current) return;
    busy.current = true; setPending(true); setError(null);
    try { setAnswer(await request(comparison.id, crypto.randomUUID())); }
    catch (failure) { const issue = failure instanceof AiFailure ? failure : new AiFailure("AI_UNAVAILABLE"); setError(issue); blockedUntil.current = Date.now() + (issue.retryAfterSeconds ?? 0) * 1000; setWait(issue.retryAfterSeconds ?? 0); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="explanation-panel" aria-labelledby="explanation-title"><h3 id="explanation-title">Why this time fits</h3>
    {answer ? <ul>{answer.sentences.map((sentence, i) => <li key={i}>{sentence}</li>)}</ul> : <p className="muted">{comparison.differenceMg > 0 ? "This time has a lower forecast estimate than your reviewed baseline" : "Your baseline already has the lowest forecast estimate"}, fits the deadline and avoids your blocked periods. This is an estimate using assumed cycle energy and the national grid signal.</p>}
    {request && !answer ? <details><summary>Ask AI to select the key reasons</summary><p className="field-hint">Only checked comparison facts and eligible reason codes are sent to Gemini or Groq. No timing text, identity or history is included. The calculation is already complete.</p><label className="check-label"><input type="checkbox" checked={consent} disabled={pending} onChange={(event) => setConsent(event.target.checked)} />I agree to send these comparison facts for AI explanation.</label><button type="button" className="text-button" disabled={!consent || pending || wait > 0} onClick={explain}>{pending ? "Selecting reasons…" : error ? "Start a new explanation request" : "Explain this comparison"}</button></details> : null}
    {error ? <p role="status" className="field-hint">{error.message} The comparison and reasons above remain usable.{wait > 0 ? ` You can request again in ${wait} seconds.` : ""}</p> : null}
  </section>;
}
