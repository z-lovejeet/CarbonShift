import { publicationHandler } from "@/server/publication";
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => publicationHandler(request, (await context.params).id, "bundle");
