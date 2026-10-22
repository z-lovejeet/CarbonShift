import { aiHandlers } from "@/server/ai";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return aiHandlers.explanation(request, (await context.params).id);
}
