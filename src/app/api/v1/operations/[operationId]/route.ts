import { publicationHandler } from "@/server/publication";
export const GET = async (request: Request, context: { params: Promise<{ operationId: string }> }) => publicationHandler(request, (await context.params).operationId, "operation");
