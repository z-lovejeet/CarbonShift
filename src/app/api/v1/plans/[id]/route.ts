import { planHandlers } from "@/server/plans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return planHandlers.detail(request, (await context.params).id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { lifecycleHandler } = await import("@/server/plans/lifecycle-entry");
  return lifecycleHandler(request, (await context.params).id, "delete");
}
