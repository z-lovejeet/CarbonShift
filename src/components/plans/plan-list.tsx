"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { PlanPage } from "@/contracts/planning";
import { planningApi } from "@/lib/planning-api";
import { grams, londonLabel } from "@/lib/presentation";
import { ErrorNotice } from "@/components/planner/error-notice";

export function PlanList({ initial }: { initial: PlanPage }) {
  const [page, setPage] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null);
  const loading = useRef(false);
  async function more() {
    if (!page.nextCursor || loading.current) return;
    loading.current = true; setBusy(true); setError(null);
    try {
      const next = await planningApi.page(page.nextCursor);
      setPage((previous) => ({ items: [...previous.items, ...next.items.filter((item) => !previous.items.some((old) => old.id === item.id))], nextCursor: next.nextCursor }));
    } catch (failure) { setError(failure as Error); }
    finally { loading.current = false; setBusy(false); }
  }
  if (!page.items.length) return <section className="empty-state"><p className="eyebrow">A fresh start</p><h2>Your first wash plan starts here.</h2><p>Choose a window that works for you. We’ll compare the forecast with the time you would otherwise run it.</p><Link href="/app/plan/new" className="button">Plan a wash</Link></section>;
  return <>
    <ul className="plan-list">{page.items.map((plan) => <li key={plan.id}>
      <div><p className="eyebrow">Washing plan · {plan.publication === "private" ? "Private" : plan.publication}</p><h2><Link href={`/app/plans/${plan.id}`}>{londonLabel(plan.selected.startUtc)}</Link></h2><p>Finish {londonLabel(plan.selected.endUtc)}</p><p className="muted">Original forecast · {plan.status === "cancelled" ? "cancelled" : plan.completion === "ran" ? "execution self-reported" : plan.completion === "did_not_run" ? "reported not run" : "execution not reported"}</p></div>
      <div className="plan-list-estimate"><strong>{grams(plan.selected.estimatedMg)} g CO₂</strong><span>estimated grid-associated CO₂</span><span>{plan.differenceMg === 0 ? "No estimated improvement" : `${grams(plan.differenceMg)} g lower than your baseline`}</span></div>
    </li>)}</ul>
    {error ? <ErrorNotice error={error} /> : null}
    {page.nextCursor ? <button className="button secondary" disabled={busy} onClick={more}>{busy ? "Loading plans…" : "Load more plans"}</button> : null}
    {busy ? <p className="muted" role="status">Loading your next plans.</p> : null}
  </>;
}
