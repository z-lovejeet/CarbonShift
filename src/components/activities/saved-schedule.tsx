import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";
import { SchedulePublication } from "./schedule-publication";
import { getWebEnvironment } from "@/server/env";
import { requireMember } from "@/server/auth/session";
import { schedulePublicationState } from "@/server/schedules/publication";
import type { SchedulePublicationState } from "@/contracts/schedule-publication";
import { ScheduleExplanation } from "./schedule-explanation";
import { ScheduleLifecycle } from "./schedule-lifecycle";
import type { ScheduleHistory } from "@/contracts/schedule-lifecycle";
import Link from "next/link";
import type { ScheduleDocument } from "@/contracts/schedules";
import { ScheduleComparisonView } from "./schedule-comparison";
import { londonLabel } from "@/lib/presentation";
export async function SavedSchedule({ plan, history }: { plan: ScheduleDocument; history: ScheduleHistory }) {
  const member = await requireMember(), env = getWebEnvironment(); let publication: SchedulePublicationState | null = null, failed = false;
  try { publication = await schedulePublicationState(member.client, member.userId, plan.id); } catch { failed = true; }
  return <div className="product-page saved-schedule-page"><PageHeader eyebrow={plan.comparison.input.kind === "day" ? "Your saved routine / Day plan" : "Your saved routine / Task plan"} title={plan.comparison.input.kind === "day" ? "Your saved day" : "Your saved schedule"} description={`${plan.comparison.input.tasks.length} activities, with the reviewed assumptions, original forecast and later reports kept together.`} back={{href:"/app",label:"Your plans"}} actions={<Link className="button secondary" href="/app/plan/new">Plan more tasks <span aria-hidden="true">↗</span></Link>} />
    <div className="saved-notice"><strong>Saved privately on {londonLabel(plan.acceptedAtUtc)}</strong><p>The reviewed tasks and original forecast are kept unchanged. This is your accepted estimate; current advice and any separately consented public copy have their own context and status. No appliance was started or measured.</p></div>
    <nav className="report-navigation" aria-label="Saved schedule sections"><a href="#forecast">Forecast comparison <span aria-hidden="true">↓</span></a><a href="#completion">Reports &amp; corrections <span aria-hidden="true">↓</span></a><a href="#publication">Optional publication <span aria-hidden="true">↓</span></a></nav>
    <div id="forecast" className="report-anchor"><ScheduleComparisonView comparison={plan.comparison} optionIndex={plan.optionIndex} /></div><ScheduleExplanation id={plan.id} /><ScheduleLifecycle plan={plan} history={history} /><div id="publication" className="report-anchor"><SchedulePublication id={plan.id} initial={publication} initialFailed={failed} available={env.ledger.enabled && env.ledger.householdEnabled} hasReports={history.reports.length > 0} /></div>
    <WorkspaceNotes title="Read the forecast and reported result separately." link={{href:"/methodology#reports",label:"How updated estimates work"}}><p>The original comparison keeps the energy and source data reviewed at acceptance. Later task reports use self-reported timing with updated actual grid factors where available. Missing tasks, missing factors and changed energy assumptions remain visible; a covered subtotal is never the whole schedule.</p><p>A correction adds history rather than replacing it. Saving or correcting a private report never automatically publishes it. Review the public disclosure separately if you choose to create or update a receipt.</p></WorkspaceNotes>
  </div>;
}
