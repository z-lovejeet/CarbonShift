"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { readPlanningApi } from "@/lib/planning-api";
import { ErrorNotice } from "@/components/planner/error-notice";
export function AccountControls({ reauthenticated }: { reauthenticated: boolean }) {
  const [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState(false), [deleted, setDeleted] = useState(false), [error, setError] = useState<Error | null>(null);
  const pending = useRef(false), key = useRef<string | null>(null);
  async function remove() {
    if (pending.current || !acknowledged) return; pending.current = true; setBusy(true); setError(null); key.current ??= crypto.randomUUID();
    try { await readPlanningApi("/account/delete", z.strictObject({ deleted: z.literal(true) }), { acknowledgeDeletion: true }, key.current); setDeleted(true); window.location.replace("/login?account=deleted"); }
    catch (failure) { setError(failure as Error); }
    finally { pending.current = false; setBusy(false); }
  }
  if (deleted) return <p className="notice" role="status">Your account and private plans were deleted.</p>;
  return <section className="account-deletion"><h2>Delete your account</h2><p>Removes your sign-in identity, private plans, reports and results. Quota and abuse-prevention metadata expire under the existing retention policy. Your Google or GitHub account is kept.</p><label className="checkbox-row"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={busy} />I understand that my CarbonShift account and private history will be permanently deleted.</label>{error ? <ErrorNotice error={error} /> : null}<button className="button danger" disabled={!reauthenticated || !acknowledged || busy} onClick={remove}>{busy ? "Deleting account…" : "Delete my CarbonShift account"}</button>{!reauthenticated ? <p className="field-hint">First confirm your identity above. The confirmation lasts ten minutes.</p> : null}</section>;
}
