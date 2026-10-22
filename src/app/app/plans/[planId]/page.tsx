import { ResultHistory } from "@/components/plans/result-history";
import { LifecycleActions } from "@/components/plans/lifecycle-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pageContext } from "@/server/plans/page-context";
import { ApiError } from "@/server/http/errors";
import { planSchema } from "@/contracts/planning";
import { ForecastView } from "@/components/planner/forecast-view";
import { londonLabel } from "@/lib/presentation";
import { SavedExplanation } from "@/components/planner/saved-explanation";
import { getWebEnvironment } from "@/server/env";
export const dynamic = "force-dynamic";
export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { repository } = await pageContext();
  const { planId } = await params;
  if (!z.uuid().safeParse(planId).success) notFound();
  let plan;
  try { plan = planSchema.parse(await repository.detail(planId)); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <section className="system-message"><h1>Your plan couldn’t be loaded.</h1><p role="alert">Please try again. Its saved inputs have not been changed.</p><p className="reference">Reference: {randomUUID()}</p><a href={`/app/plans/${planId}`} className="button">Try again</a></section>;
  }
  return <><Link className="text-link" href="/app">← Your plans</Link><header className="page-heading"><div><p className="eyebrow">Private · saved washing plan</p><h1>Your saved plan</h1><p className="lead">Start {londonLabel(plan.comparison.selected.startUtc)}<br />Finish {londonLabel(plan.comparison.selected.endUtc)}</p></div><Link href="/app/plan/new" className="button secondary">Plan another wash</Link></header>
    <div className="saved-notice"><strong>Saved privately on {londonLabel(plan.acceptedAtUtc)}</strong><p>The reviewed inputs and forecast are kept unchanged. This is a saved forecast, not current advice. No appliance was started or measured.</p></div>
    <div className="plan-evidence"><span>Plan: {plan.status}</span><span>Execution: {plan.completion.replaceAll("_", " ")}</span><span>Publication: private</span></div>
    <div className="planner-width"><ResultHistory plan={plan} /><LifecycleActions plan={plan} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} /><SavedExplanation comparison={{ ...plan.comparison, schemaVersion: 1, id: plan.comparisonId, version: 1 }} available={getWebEnvironment().ai.enabled} /></div>
    <div className="planner-width"><details className="source-details" open={!plan.latestReport}><summary>Original forecast comparison</summary><ForecastView comparison={plan.comparison} snapshot={plan.forecastSnapshot} savedAtUtc={plan.acceptedAtUtc} /></details><details className="source-details"><summary>Your confirmed constraints</summary><dl className="review-list"><div><dt>Window</dt><dd>{londonLabel(plan.comparison.constraints.earliestStartUtc)} → {londonLabel(plan.comparison.constraints.deadlineUtc)}</dd></div><div><dt>Blocked periods</dt><dd>{plan.comparison.constraints.blockedIntervals.length ? <ul>{plan.comparison.constraints.blockedIntervals.map((block) => <li key={block.startUtc}>{londonLabel(block.startUtc)} → {londonLabel(block.endUtc)}</li>)}</ul> : "None"}</dd></div></dl></details></div>
  </>;
}
