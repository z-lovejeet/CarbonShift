import { subject } from "@/server/limits/budgets";
import { pageContext } from "@/server/plans/page-context";
import { getWebEnvironment } from "@/server/env";
import { candidates } from "@/config/ai-policy";
import { ACTIVITY_PROFILES } from "@/data/activity-profiles";
import { Simulator } from "@/components/activities/simulator";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide, WorkspaceNotes } from "@/components/ui/page-guide";
export const dynamic = "force-dynamic";
export default async function SimulationPage() {
  const { member } = await pageContext();
  const { ai, rateLimitHmacSecret } = getWebEnvironment();
  return <div className="product-page simulator-page"><PageHeader eyebrow="Understand / Household electricity" title="Explore your energy use." description="From a few minutes of cleaning to an evening with the TV. Model the electricity behind an activity and see how its timing affects estimated grid CO₂." back={{href:"/app",label:"Your plans"}} />
    <PageGuide items={[{title:"Choose what you’re using",text:"Pick a category, active duration and quantity. Describe it with optional assistance or enter the details yourself."},{title:"Confirm the energy basis",text:"Use device watts, kWh per cycle or an exact reviewed reference. Unknown energy needs an input."},{title:"Explore the estimate",text:"Review electricity, applicable grid factors and the time breakdown. Carry the reviewed activity into a plan when ready."}]} />
    <Simulator ownerTag={subject(rateLimitHmacSecret!, "activity-handoff", member.userId)} profiles={[...ACTIVITY_PROFILES]} nowUtc={new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} aiAvailable={ai.enabled && candidates(ai.policy, "constraints", false, "activity-v2").length > 0} />
    <WorkspaceNotes title="Useful inputs make a useful estimate." link={{href:"/methodology#energy",label:"Choosing your energy basis"}}><p>Operating watts describe the power while a device runs. Cycle energy describes the electricity for a complete programme. For powered cleaning, enter the time the motor is actually active. Rated or maximum watts are a scenario, not a measurement of average consumption.</p><p>Future activities use forecast grid factors; completed activities use retrospective actual factors where available. If grid data is missing, your input-based electricity estimate can still be shown. Water, fuels, detergent and manufacture are outside this calculation.</p></WorkspaceNotes>
  </div>;
}
