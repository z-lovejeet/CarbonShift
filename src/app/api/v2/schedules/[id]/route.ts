import { scheduleRequest } from "@/server/schedules/handlers";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { return scheduleRequest(request, "detail", (await params).id); }

import { scheduleLifecycle } from "@/server/schedules/lifecycle";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { return scheduleLifecycle(request, (await params).id, "delete"); }
