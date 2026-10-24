import { redirect } from "next/navigation";
import { createScheduleRepository } from "@/server/schedules/repository";
import { createServiceClient } from "@/server/db/clients";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pageContext } from "@/server/plans/page-context";
import { ApiError } from "@/server/http/errors";
import { CompletionForm } from "@/components/plans/completion-form";
export const dynamic = "force-dynamic";
export default async function CompletionPage({ params }: { params: Promise<{ planId: string }> }) {
  const { repository, member } = await pageContext(); const { planId } = await params;
  if (!z.uuid().safeParse(planId).success) notFound();
  const plan = await repository.detail(planId).catch(async (error: unknown) => { if (error instanceof ApiError && error.status === 404) { try { await createScheduleRepository(member.client, createServiceClient(), member.userId).detail(planId); } catch (householdError) { if (householdError instanceof ApiError && householdError.status === 404) notFound(); throw householdError; } redirect(`/app/plans/${planId}#completion`); } throw error; });
  return <div className="product-page planner-width"><PageHeader eyebrow="Your saved plan / Private execution report" title={plan.latestReport ? "Correct what happened" : "What happened with your wash?"} description="Keep your original plan and your later report side by side. Record the full activity only after it finishes, or tell us that it did not run." back={{href:`/app/plans/${planId}`,label:"Your saved plan"}} />{plan.status === "cancelled" ? <p className="notice">This plan is cancelled. It cannot be corrected or restarted. Create a new plan.</p> : <CompletionForm plan={plan} />}
    <WorkspaceNotes title="Your report keeps the evidence in context." link={{href:"/methodology#reports",label:"Reports and updated factors"}}><p>Confirm whether the accepted duration and energy still apply. If they changed, the report remains in history without a comparable updated estimate. Missing actual grid factors remain unavailable, and non-execution earns no avoided-emissions amount.</p><p>A correction appends a new report. It does not overwrite the original forecast or automatically update a public receipt.</p></WorkspaceNotes>
  </div>;
}
