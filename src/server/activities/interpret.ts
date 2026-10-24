import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { activityInterpretRequestSchema } from "@/contracts/activity-ai";
import { londonTime } from "@/domain/time";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { getWebEnvironment } from "@/server/env";
import { ApiError, publicFailure } from "@/server/http/errors";
import { assertSameOrigin, readJson } from "@/server/http/request";
import { mutationIngress } from "@/server/limits/ingress";
import { createAiStore } from "@/server/ai/store";
import { createProviderAdapters } from "@/server/ai/providers";
import { runAiTask } from "@/server/ai/router";
import { validateActivitySuggestion } from "@/server/ai/activity-variant";

export async function interpretActivity(request: Request) {
  const requestId = randomUUID();
  try {
    const config = databaseConfiguration(); assertSameOrigin(request, config.origin);
    const member = await requireMember(); await mutationIngress(member.userId);
    const body = activityInterpretRequestSchema.safeParse(await readJson(request)), key = z.uuid().safeParse(request.headers.get("AI-Task-Key"));
    if (!body.success || !key.success) throw new ApiError("INVALID_INPUT", 422, "Check the description and consent, then retry.");
    const referenceDate = londonTime(new Date().toISOString().replace(/\.\d{3}Z$/, "Z")).date;
    if (body.data.referenceDate !== referenceDate) throw new ApiError("AI_REFERENCE_DATE_CHANGED", 409, "The London date changed. Review your description and try again.");
    const env = getWebEnvironment();
    if (!env.ai.enabled) throw new ApiError("AI_UNAVAILABLE", 503, "Assistance is unavailable. Use the activity fields below.");
    const data = await runAiTask({ owner: member.userId, actor: member.userId, role: "constraints", variant: "activity-v2", key: key.data, requestId, signal: request.signal,
      policy: env.ai.policy, input: { text: body.data.text, referenceDate, timezone: "Europe/London" }, validate: (value) => validateActivitySuggestion(value, body.data.text) },
    { store: createAiStore(createServiceClient()), hmac: config.hmac, adapters: createProviderAdapters(env.ai) });
    return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return publicFailure(error, requestId); }
}
