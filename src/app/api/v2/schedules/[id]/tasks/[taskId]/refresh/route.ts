import { scheduleLifecycle } from "@/server/schedules/lifecycle";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) { const { id, taskId } = await params; return scheduleLifecycle(request, id, "refresh", taskId); }
