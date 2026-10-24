"use client";
import { useState } from "react";
import { z } from "zod";
import { activityRequest } from "@/lib/activity-api";
const response = z.strictObject({ schemaVersion: z.literal(2), codes: z.array(z.string()).max(6), sentences: z.array(z.string().max(1000)).max(7), source: z.enum(["ai", "cache", "template"]) });
export function ScheduleExplanation({ id }: { id: string }) {
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState<z.infer<typeof response> | null>(null), [error, setError] = useState<string | null>(null);
  async function explain() { setBusy(true); setError(null); try { setResult(await activityRequest(`/schedules/${id}/explanation`, response, { aiConsent: true }, { taskKey: crypto.randomUUID() })); } catch { setError("Assistance is unavailable. The comparison and assumptions above remain available."); } finally { setBusy(false); } }
  return <details className="source-details"><summary>Explain this schedule</summary><p>Optional assistance selects reasons from verified scheduling facts. Numbers and conclusions in your report come from the calculation engine.</p>{result ? <><p className="field-hint">{result.source === "template" ? "Standard explanation · assistance unavailable or not enabled" : result.source === "cache" ? "Previously checked explanation · no new model request" : "Assisted explanation · checked against this schedule"}</p><ul>{result.sentences.map((text) => <li key={text}>{text}</li>)}</ul></> : <><label className="check-label"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Send this schedule’s reason codes to the configured AI provider. Private task names and routine text are excluded.</span></label><button className="button secondary" disabled={!consent || busy} onClick={() => void explain()}>{busy ? "Preparing explanation…" : "Explain the result"}</button></>}{error ? <p role="alert">{error}</p> : null}</details>;
}
