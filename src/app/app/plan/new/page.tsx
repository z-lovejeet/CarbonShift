import { pageContext } from "@/server/plans/page-context";
import { LivePlanner } from "@/components/planner/live-planner";
import { getWebEnvironment } from "@/server/env";
export const dynamic = "force-dynamic";
export default async function NewPlanPage() {
  await pageContext();
  return <><header className="page-heading"><div><p className="eyebrow">Live planning · Great Britain</p><h1>Plan a wash</h1><p className="lead">Your routine first. A forecast comparison to help you choose.</p></div></header><LivePlanner aiAvailable={getWebEnvironment().ai.enabled} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} /></>;
}
