import { scheduleLifecycle } from "@/server/schedules/lifecycle";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { return scheduleLifecycle(request, (await params).id, "history"); }
