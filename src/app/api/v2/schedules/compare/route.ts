import { scheduleRequest } from "@/server/schedules/handlers";
export const POST = (request: Request) => scheduleRequest(request, "compare");
