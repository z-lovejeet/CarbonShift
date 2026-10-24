import { schedulePublication } from "@/server/schedules/publication";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return schedulePublication(request, (await params).id, "preview"); }
