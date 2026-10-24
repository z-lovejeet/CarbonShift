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
export default async function DayPlannerPage() {
  const { member } = await pageContext(); const { ai, rateLimitHmacSecret } = getWebEnvironment();
  return <div className="product-page day-planning-page"><PageHeader eyebrow="Organize / A London calendar day" title="A better rhythm for your day." description={`Bring up to ${ACTIVITY_METHOD.maximumTasks} activities into one routine. Keep your commitments in place and compare the flexible parts together.`} back={{href:"/app",label:"Your plans"}} />
    <PageGuide items={[{title:"Choose the day",text:"Use a date covered by the available grid forecast. All task windows stay inside that London calendar day."},{title:"Give every task its place",text:"Set usual times, flexible windows, fixed appointments, equipment and any order the activities need to follow."},{title:"Review the whole routine",text:"Compare timelines and per-task estimates. Save the full day together, then report activities individually afterward."}]} />
    <TaskPlanner ownerTag={subject(rateLimitHmacSecret!, "activity-handoff", member.userId)} kind="day" profiles={[...ACTIVITY_PROFILES]} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} aiAvailable={ai.enabled && candidates(ai.policy, "constraints", false, "activity-v2").length > 0} />
    <WorkspaceNotes title="A complete day, with real boundaries." link={{href:"/methodology#time",label:"London time and day boundaries"}}><p>The engine keeps fixed starts in place, waits for predecessor tasks to finish and avoids overlapping shared equipment or tasks that need your attention. Tasks on different unattended equipment can overlap when your constraints allow it.</p><p>A London day can contain 23, 24 or 25 elapsed hours when the clocks change. The planner respects those calendar boundaries; it never moves a task into the next day silently. Missing or unreported activities remain visible in later results, so a partial day never becomes a complete-day benefit claim.</p></WorkspaceNotes>
  </div>;
}
