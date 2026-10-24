import { publicationHandler } from "@/server/publication";
export const POST = async (request: Request, context: { params: Promise<{ id: string; revision: string }> }) => { const p = await context.params; return publicationHandler(request, p.id, "consent", p.revision); };
