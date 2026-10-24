import { subject } from "@/server/limits/budgets";
import { pageContext } from "@/server/plans/page-context";
import { getWebEnvironment } from "@/server/env";
import { candidates } from "@/config/ai-policy";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { ACTIVITY_METHOD } from "@/domain/activities/method";
import { TaskPlanner } from "@/components/activities/task-planner";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide, WorkspaceNotes } from "@/components/ui/page-guide";
export const dynamic = "force-dynamic";
export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { member } = await pageContext(); const { ai, rateLimitHmacSecret } = getWebEnvironment(), query = await searchParams;
  return <div className="product-page task-planning-page"><PageHeader eyebrow="Compare / Your available windows" title="Make room for cleaner energy." description={`One task or up to ${ACTIVITY_METHOD.maximumTasks}. Keep the times that matter, then compare the flexible parts against the times you would normally use.`} back={{href:"/app",label:"Your plans"}} />
    <PageGuide items={[{title:"Build your task list",text:"Give each activity a duration, reviewed energy basis, usual time and one or more available windows."},{title:"Review what must fit",text:"Keep appointments fixed. Block busy periods, share equipment and set tasks that must finish first."},{title:"Compare and choose",text:"Review the baseline, proposed timings and assumptions together. Save the exact option you decide to use."}]} />
    <TaskPlanner ownerTag={subject(rateLimitHmacSecret!, "activity-handoff", member.userId)} profiles={[...ACTIVITY_PROFILES]} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} aiAvailable={ai.enabled && candidates(ai.policy, "constraints", false, "activity-v2").length > 0} handoff={query.from === "simulator"} />
    <WorkspaceNotes title="Your usual time is part of the comparison." link={{href:"/methodology#scheduling",label:"How the timing search works"}}><p>The baseline must be a complete, feasible routine you could actually follow. Electricity, duration and quantity stay the same in each timing option. A task must fit fully inside an available window and respect its blocked periods, equipment, attention and task dependencies.</p><p>No improvement is a valid outcome. Task planning can compare a separate 30-minute window extension, but it only changes your draft after you choose to apply it and review again. Only schedule equipment in safe operating conditions.</p></WorkspaceNotes>
  </div>;
}
