import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";
import type { ScheduleDocument } from "@/contracts/schedules";
import type { ScheduleHistory } from "@/contracts/schedule-lifecycle";
import { createScheduleRepository } from "@/server/schedules/repository";
import { createServiceClient } from "@/server/db/clients";
import { SavedSchedule } from "@/components/activities/saved-schedule";
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
import { PublicationPanel } from "@/components/plans/publication-panel";
import { createPublicationRepository } from "@/server/publication/repository";
import type { PublicationState } from "@/contracts/publication";
export const dynamic = "force-dynamic";
export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { repository, member } = await pageContext();
  const { planId } = await params;
  if (!z.uuid().safeParse(planId).success) notFound();
  let plan, household: ScheduleDocument | null = null, householdHistory: ScheduleHistory | null = null;
  try { plan = planSchema.parse(await repository.detail(planId)); }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      try {
        const householdRepository = createScheduleRepository(member.client, createServiceClient(), member.userId);
        household = await householdRepository.detail(planId);
        householdHistory = await householdRepository.history(planId);
      } catch (householdError) { if (householdError instanceof ApiError && householdError.status === 404) notFound(); }
    }
  }
  if (household && householdHistory) return <SavedSchedule plan={household} history={householdHistory} />;
  if (!plan) return <section className="system-message product-page"><h1>Your plan couldn’t be loaded.</h1><p role="alert">Please try again. Its saved inputs have not been changed.</p><p className="reference">Reference: {randomUUID()}</p><a href={`/app/plans/${planId}`} className="button">Try again</a></section>;
  let publication: PublicationState | null = null, publicationFailed = false;
  try { publication = await createPublicationRepository(member.client, member.client, member.userId).state(planId); } catch { publicationFailed = true; }
  return <div className="product-page saved-plan-page"><PageHeader eyebrow="Earlier washing plan / Original method" title="Your saved plan" description={<>Start {londonLabel(plan.comparison.selected.startUtc)}<br />Finish {londonLabel(plan.comparison.selected.endUtc)}</>} back={{href:"/app",label:"Your plans"}} actions={<Link href="/app/plan/new" className="button secondary">Plan more tasks <span aria-hidden="true">↗</span></Link>} />
    <div className="saved-notice"><strong>Saved privately on {londonLabel(plan.acceptedAtUtc)}</strong><p>The reviewed inputs and forecast are kept unchanged. This is a saved forecast, not current advice. No appliance was started or measured.</p></div>
    <div className="plan-evidence"><span>Plan: {plan.status}</span><span>Execution: {plan.completion.replaceAll("_", " ")}</span><span>Publication: {plan.publication}</span></div>
    <div className="planner-width"><ResultHistory plan={plan} /><LifecycleActions plan={plan} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} /><SavedExplanation comparison={{ ...plan.comparison, schemaVersion: 1, id: plan.comparisonId, version: 1 }} available={getWebEnvironment().ai.enabled} /></div>
    <div className="planner-width"><PublicationPanel planId={plan.id} latestRevision={plan.latestResult?.sequence ?? null} cancelled={plan.status === "cancelled"} available={getWebEnvironment().ledger.enabled} initial={publication} initialFailed={publicationFailed} /></div>
    <div className="planner-width"><details className="source-details" open={!plan.latestReport}><summary>Original forecast comparison</summary><ForecastView comparison={plan.comparison} snapshot={plan.forecastSnapshot} savedAtUtc={plan.acceptedAtUtc} /></details><details className="source-details"><summary>Your confirmed constraints</summary><dl className="review-list"><div><dt>Window</dt><dd>{londonLabel(plan.comparison.constraints.earliestStartUtc)} → {londonLabel(plan.comparison.constraints.deadlineUtc)}</dd></div><div><dt>Blocked periods</dt><dd>{plan.comparison.constraints.blockedIntervals.length ? <ul>{plan.comparison.constraints.blockedIntervals.map((block) => <li key={block.startUtc}>{londonLabel(block.startUtc)} → {londonLabel(block.endUtc)}</li>)}</ul> : "None"}</dd></div></dl></details></div>
    <WorkspaceNotes title="This record retains its original method." link={{href:"/methodology#versions",label:"Understanding saved versions"}}><p>This earlier washing plan keeps the inputs, original forecast and calculation method used when you accepted it. Your later execution report is separate. Corrections append to history, and public result copies need their own disclosure consent.</p></WorkspaceNotes>
  </div>;
}
