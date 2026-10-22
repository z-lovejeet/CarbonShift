import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pageContext } from "@/server/plans/page-context";
import { ApiError } from "@/server/http/errors";
import { CompletionForm } from "@/components/plans/completion-form";
export const dynamic = "force-dynamic";
export default async function CompletionPage({ params }: { params: Promise<{ planId: string }> }) {
  const { repository } = await pageContext(); const { planId } = await params;
  if (!z.uuid().safeParse(planId).success) notFound();
  const plan = await repository.detail(planId).catch((error: unknown) => { if (error instanceof ApiError && error.status === 404) notFound(); throw error; });
  return <div className="planner-width"><Link className="text-link" href={`/app/plans/${planId}`}>← Your saved plan</Link><header className="page-heading"><div><p className="eyebrow">Private execution report</p><h1>{plan.latestReport ? "Correct what happened" : "What happened with your wash?"}</h1><p className="lead">Keep your original plan and your later report side by side.</p></div></header>{plan.status === "cancelled" ? <p className="notice">This plan is cancelled. It cannot be corrected or restarted. Create a new washing plan.</p> : <CompletionForm plan={plan} />}</div>;
}
