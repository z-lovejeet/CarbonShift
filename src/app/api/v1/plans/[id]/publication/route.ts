import { publicationHandler } from "@/server/publication";
export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => publicationHandler(request, (await context.params).id, "consent");
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => publicationHandler(request, (await context.params).id, "state");
