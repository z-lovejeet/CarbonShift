import { scheduleRequest } from "@/server/schedules/handlers";
export const POST = (request: Request) => scheduleRequest(request, "accept");
export const GET = (request: Request) => scheduleRequest(request, "list");
