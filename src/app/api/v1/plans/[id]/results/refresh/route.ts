import { lifecycleHandler } from "@/server/plans/lifecycle-entry";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return lifecycleHandler(request, (await params).id, "refresh");
}
