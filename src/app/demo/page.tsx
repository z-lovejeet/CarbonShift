import Link from "next/link";
import { HouseholdDemo } from "@/components/demo/household-demo";
import { DemoPlanner } from "@/components/demo/demo-planner";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";
export default function DemoPage() {
  return <div className="product-page demo-page"><PageHeader eyebrow="Explore / A clearly labeled example" title="A little room. A different time." description="Try an authored household day and the earlier washing example. Explore how constraints, missing data and timing choices change the result, without creating an account." />
    <aside className="demo-intro"><div><h2>A demonstration you can inspect.</h2><p>The grid values, device assumptions and clock are synthetic and fixed. Every choice stays in this browser. This page makes no live save, appliance connection or blockchain transaction, and its results are not current advice.</p></div><Link className="text-link" href="/login">Continue to your account <span aria-hidden="true">↗</span></Link></aside>
    <details className="household-demo-section" open><summary>Explore a household day</summary><HouseholdDemo /></details>
    <section className="product-section"><div className="product-section-heading"><div><h2>Keep the earlier method in view.</h2><p>The original washing example uses its own assumptions and method. Its controls are a local preview, while real saved washing records retain their original calculations.</p></div></div><details className="source-details"><summary>Try the earlier washing planner</summary><div className="legacy-demo"><DemoPlanner /></div></details></section>
    <WorkspaceNotes title="When you are ready, use your own inputs." link={{href:"/app/simulate",label:"Explore an activity"}}><p>The live tools use your reviewed device energy, chosen times and applicable Great Britain grid factors. A demonstration scenario never becomes a live comparison or an outage fallback. Start with the simulator, or go straight to task/day planning when you know your routine.</p></WorkspaceNotes>
  </div>;
}
