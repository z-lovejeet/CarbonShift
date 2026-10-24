import { explainSchedule } from "@/server/schedules/explanation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return explainSchedule(request, (await params).id); }
