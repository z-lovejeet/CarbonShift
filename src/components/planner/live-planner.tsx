"use client";
import { useRouter } from "next/navigation";
import { planningApi, PlanningFailure } from "@/lib/planning-api";
import { PlannerFlow } from "./planner-flow";
import type { ComparisonRequest } from "@/contracts/planning";

export function LivePlanner({ nowUtc, aiAvailable = false }: { nowUtc: string; aiAvailable?: boolean }) {
  const router = useRouter();
  async function compare(input: ComparisonRequest) {
    const issued = await planningApi.compare(input);
    const view = await planningApi.comparison(issued.id);
    if (JSON.stringify(view.comparison) !== JSON.stringify(issued)) throw new PlanningFailure("INVALID_RESPONSE");
    return view;
  }
  return <PlannerFlow mode="live" aiAvailable={aiAvailable} nowUtc={nowUtc} compare={compare} save={planningApi.save} onSaved={(plan) => { router.push(`/app/plans/${plan.id}`); router.refresh(); }} />;
}
