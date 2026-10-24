"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publicationAckSchema, publicationPreviewSchema, publicationStateSchema, type PublicationPreview, type PublicationState, type LedgerOperation } from "@/contracts/publication";
import { readPlanningApi, PlanningFailure } from "@/lib/planning-api";
import { londonLabel } from "@/lib/presentation";
import { ErrorNotice } from "@/components/planner/error-notice";

const statusCopy: Record<LedgerOperation["status"], string> = {
  queued: "Queued. The local publication worker must be running to submit this record.",
  signing: "Preparing the transaction. It has not been confirmed on Sepolia.",
  submitted: "Submitted to Sepolia. Waiting for inclusion and two further blocks.",
  confirmed: "Confirmed on Sepolia when last checked. This binds the disclosed content; it does not verify appliance operation.",
  uncertain: "The transaction could not be confirmed. The worker will reconcile the original transaction; a new record is not created.",
  failed: "Publication failed. Your private plan and its history remain available.",
};
function TransactionStatus({ operation }: { operation: LedgerOperation }) {
  return <div className="transaction-status"><p><strong>{operation.kind === "plan" ? "Plan commitment" : "Result publication"}: {operation.status}</strong></p><p>{statusCopy[operation.status]}</p>
    {operation.checkedAtUtc ? <p className="field-hint">Last checked {londonLabel(operation.checkedAtUtc)}</p> : null}
    {operation.transactionHash ? <a className="text-link" href={`https://sepolia.etherscan.io/tx/${operation.transactionHash}`} target="_blank" rel="noreferrer">View transaction on Sepolia ↗</a> : null}
  </div>;
}
export function PublicationPanel({ planId, latestRevision, cancelled, available, initial, initialFailed = false }: {
  planId: string; latestRevision: number | null; cancelled: boolean; available: boolean; initial: PublicationState | null; initialFailed?: boolean;
}) {
  const router = useRouter(), pending = useRef(false), retry = useRef<{ previewId: string; key: string } | null>(null);
  const [state, setState] = useState(initial), [preview, setPreview] = useState<PublicationPreview | null>(null), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<Error | null>(initialFailed ? new Error("Publication status could not be loaded. Refresh it before continuing.") : null);
  const [explanation, setExplanation] = useState(""), [notice, setNotice] = useState("");
  const pub = state?.publication, last = pub?.results.at(-1);
  const unpublished = latestRevision !== null && latestRevision > (last?.manifest.privateResultRevisionNumber ?? 0);
  const canPublishResult = pub?.operation.status === "confirmed" && pub.results.every((r) => r.operation.status === "confirmed") && unpublished;
  async function refresh() {
    const response = await readPlanningApi(`/plans/${planId}/publication`, publicationStateSchema);
    setState(response); return response;
  }
  async function action(kind: "refresh" | "preview" | "consent") {
    if (pending.current) return;
    pending.current = true; setBusy(kind); setError(null); setNotice("");
    try {
      if (kind === "refresh") { await refresh(); router.refresh(); return; }
      if (kind === "preview") {
        const path = canPublishResult ? `/results/${latestRevision}` : "";
        const next = await readPlanningApi(`/plans/${planId}${path}/publication-preview`, publicationPreviewSchema, canPublishResult ? { correctionExplanation: explanation } : {});
        setPreview(next); setConsent(false); retry.current = null; return;
      }
      if (!preview || !consent) return;
      retry.current ??= { previewId: preview.id, key: crypto.randomUUID() };
      const path = preview.manifest.type === "result" ? `/results/${preview.manifest.privateResultRevisionNumber}` : "";
      await readPlanningApi(`/plans/${planId}${path}/publication`, publicationAckSchema, { previewId: preview.id, manifestHash: preview.manifestHash, consentVersion: preview.consentVersion, consent: true }, retry.current.key);
      setPreview(null); setConsent(false); retry.current = null; setNotice("Your exact reviewed copy is queued for publication. Confirmation is still pending.");
      await refresh(); router.refresh();
    } catch (failure) {
      setError(failure as Error);
      if (failure instanceof PlanningFailure && failure.code === "PREVIEW_CHANGED") { setPreview(null); setConsent(false); retry.current = null; }
    } finally { pending.current = false; setBusy(null); }
  }
  return <section className="publication-panel" aria-labelledby="publication-heading"><div className="section-heading"><div><p className="eyebrow">Optional · Sepolia test network</p><h2 id="publication-heading">Publish an inspectable record</h2></div><button className="button secondary" onClick={() => action("refresh")} disabled={Boolean(busy)}>{busy === "refresh" ? "Checking status…" : "Refresh publication status"}</button></div>
    <p>Your saved plan works privately. Publication discloses the schedule, blocked times, energy assumption and grid factors so others can inspect the calculation.</p>
    {!available ? <p className="notice">New publication is currently unavailable. Private planning and reporting remain usable.</p> : null}
    {pub ? <><TransactionStatus operation={pub.operation} />{pub.results.map((r) => <div key={r.manifestHash}><h3>Public result {r.manifest.publicRevision}</h3><p>{r.manifest.reportedKind === "did_not_run" ? "Reported not run · no emissions benefit claimed" : "Execution self-reported · energy assumed"}</p><TransactionStatus operation={r.operation} /></div>)}
      {unpublished ? <p className="notice">Unpublished changes: your private result is newer than the latest public result. Nothing is published automatically.</p> : null}
      <p><a className="text-link" href={`/api/v1/plans/${planId}/publication/bundle`} download>Download consented proof bundle</a></p>
      {canPublishResult ? <div className="field"><label className="field-label" htmlFor="public-explanation">Explanation to make public{pub.results.length ? " (required for a correction)" : " (optional)"}</label><textarea id="public-explanation" rows={3} maxLength={500} value={explanation} disabled={Boolean(busy) || Boolean(preview)} onChange={(e) => setExplanation(e.target.value)} /><p className="field-hint">Write only what you want to disclose. Avoid personal information. Private report notes are not copied.</p></div> : null}
    </> : state ? <p>Publication: private. {cancelled ? "Cancelled plans cannot create a new commitment." : "Review the exact data before choosing to publish."}</p> : null}
    {available && state && !preview && ((!pub && !cancelled) || canPublishResult) ? <button className="button secondary" disabled={Boolean(busy) || Boolean(pub?.results.length && !explanation.trim())} onClick={() => action("preview")}>{busy === "preview" ? "Preparing preview…" : pub ? "Review result publication" : "Review publication"}</button> : null}
    {preview ? <div className="publication-review"><h3>Review this exact public copy</h3><p>These data and on-chain hashes may remain public after account deletion. Public copies cannot be recalled. CarbonShift issues this record; this is not a signature from your wallet.</p>
      <dl className="review-list"><div><dt>Includes</dt><dd>{preview.manifest.type === "plan" ? "Schedule, blocked periods, energy estimate, national forecast and calculation" : "Reported outcome, timing, assumed energy, available actual factors and your public explanation"}</dd></div><div><dt>Review expires</dt><dd>{londonLabel(preview.expiresAtUtc)}</dd></div><div><dt>Exact digest</dt><dd className="proof-hash">{preview.manifestHash}</dd></div></dl>
      <details className="source-details"><summary>Inspect every public field</summary><pre className="manifest-preview">{JSON.stringify(preview.manifest, null, 2)}</pre></details>
      <label className="checkbox-row"><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={(e) => setConsent(e.target.checked)} />I reviewed this exact public copy and consent to its lasting disclosure.</label>
      <div className="action-row"><button className="button" disabled={!consent || Boolean(busy)} onClick={() => action("consent")}>{busy === "consent" ? "Requesting publication…" : "Publish this exact copy"}</button><button className="button secondary" disabled={Boolean(busy)} onClick={() => { setPreview(null); setConsent(false); retry.current = null; }}>Close preview</button></div>
    </div> : null}
    {notice ? <p role="status" className="notice">{notice}</p> : null}{error ? <ErrorNotice error={error} /> : null}
    <p className="field-hint">The prototype uses a local worker. Queued work waits while it is offline. A matching commitment proves content integrity, not the truth of inputs or measured avoided emissions.</p>
  </section>;
}
