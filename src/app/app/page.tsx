import Link from "next/link";
import { randomUUID } from "node:crypto";
import { pageContext } from "@/server/plans/page-context";
import { planPageSchema } from "@/contracts/planning";
import { createScheduleRepository } from "@/server/schedules/repository";
import { createServiceClient } from "@/server/db/clients";
import { ScheduleList } from "@/components/activities/schedule-list";
import { PlanList } from "@/components/plans/plan-list";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";

export const dynamic = "force-dynamic";
export default async function PlansPage() {
  const { repository, member } = await pageContext();
  let data, schedules;
  try { const results = await Promise.all([repository.page(20), createScheduleRepository(member.client, createServiceClient(), member.userId).page(20)]); data = planPageSchema.parse(results[0]); schedules = results[1]; }
  catch { return <section className="system-message product-page"><p className="eyebrow">Your plans</p><h1>Your plans couldn’t be loaded.</h1><p role="alert">Please try again. Your saved plans have not been changed.</p><p className="reference">Reference: {randomUUID()}</p><a href="/app" className="button">Try again</a><div className="system-context">This is a loading problem. It does not mean your private history is empty or has been deleted.</div></section>; }
  return <div className="product-page dashboard-page">
    <PageHeader eyebrow="Your routine, considered" title="Your plans" description="A place for the routines you’ve reviewed, the estimates behind them and the reports you add afterward." actions={<Link href="/app/plan/new" className="button">Plan tasks <span aria-hidden="true">↗</span></Link>} />
    <div className="workspace-links"><Link href="/app/simulate"><span className="workspace-number">01 / Understand</span><strong>Simulate an activity</strong><span>Explore the electricity and estimated grid CO₂ behind one device, duration and time.</span><span className="workspace-entry">Explore an activity ↗</span></Link><Link href="/app/plan/new"><span className="workspace-number">02 / Compare</span><strong>Plan your tasks</strong><span>Give each task its own window. Keep fixed times, shared equipment and task order in place.</span><span className="workspace-entry">Plan your tasks ↗</span></Link><Link href="/app/day/new"><span className="workspace-number">03 / Organize</span><strong>Plan my day</strong><span>Bring your fixed and flexible activities together in one London calendar day.</span><span className="workspace-entry">Plan my day ↗</span></Link></div>
    <section className="product-section" aria-labelledby="saved-schedules-heading"><div className="product-section-heading"><div><h2 id="saved-schedules-heading">Your saved household schedules</h2><p>Open a schedule to revisit its frozen forecast, report activities and review any separately consented public copy.</p></div></div>{schedules.items.length ? <ScheduleList initial={schedules} /> : <section className="empty-state"><p className="eyebrow">Ready when you are</p><h2>Make your next routine a considered one.</h2><p>Schedules appear here after you compare and save. Start with an activity, the device energy you know and a window that genuinely works for you.</p><Link href="/app/plan/new" className="button">Plan your tasks <span aria-hidden="true">↗</span></Link></section>}</section>
    {data.items.length ? <section className="product-section"><div className="product-section-heading"><div><h2>Earlier washing plans</h2><p>Your original washing plans retain their saved assumptions, method and report history.</p></div></div><PlanList initial={data} /></section> : null}
    <WorkspaceNotes title="A saved plan keeps its original context." link={{href:"/methodology",label:"Understand the estimates"}}><p>A new grid forecast does not silently change an accepted schedule. After an activity, add a self-report and refresh the updated estimate when actual factors become available. Private reports and public receipts remain separate choices.</p><p>Current guidance uses Great Britain’s national grid signal. Energy comes from your reviewed inputs; CarbonShift does not control or measure your appliances.</p></WorkspaceNotes>
  </div>;
}
