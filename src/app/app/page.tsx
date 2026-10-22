import Link from "next/link";
import { randomUUID } from "node:crypto";
import { pageContext } from "@/server/plans/page-context";
import { planPageSchema } from "@/contracts/planning";
import { PlanList } from "@/components/plans/plan-list";

export const dynamic = "force-dynamic";
export default async function PlansPage() {
  const { repository } = await pageContext();
  let data;
  try { data = planPageSchema.parse(await repository.page(20)); }
  catch { return <section className="system-message"><p className="eyebrow">Your plans</p><h1>Your plans couldn’t be loaded.</h1><p role="alert">Please try again. Your saved plans have not been changed.</p><p className="reference">Reference: {randomUUID()}</p><a href="/app" className="button">Try again</a></section>; }
  return <><header className="page-heading"><div><p className="eyebrow">Your routine, considered</p><h1>Your plans</h1><p className="lead">Private washing plans, with the assumptions kept alongside.</p></div>{data.items.length ? <Link href="/app/plan/new" className="button">Plan a wash</Link> : null}</header><PlanList initial={data} /><p className="page-footnote">Great Britain national estimates. Cycle energy is assumed. CarbonShift does not control or measure your appliance.</p></>;
}
