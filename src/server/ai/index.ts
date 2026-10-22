import "server-only";
import { getWebEnvironment } from "@/server/env";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { mutationIngress } from "@/server/limits/ingress";
import { createPlanRepository } from "@/server/plans/repository";
import { createAiStore, createExplanationCache } from "./store";
import { createProviderAdapters } from "./providers";
import { createAiHandlers } from "./handlers";

export const aiHandlers = createAiHandlers({
  origin: () => databaseConfiguration().origin, ingress: mutationIngress,
  now: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  async authenticate() {
    const member = await requireMember(), writer = createServiceClient();
    return { userId: member.userId, comparison: createPlanRepository(member.client, writer, member.userId).comparison, cache: createExplanationCache(writer, member.userId, databaseConfiguration().hmac) };
  },
  runtime() {
    const env = getWebEnvironment(); if (!env.ai.enabled) return null;
    return { policy: env.ai.policy, dependencies: { store: createAiStore(createServiceClient()), hmac: env.rateLimitHmacSecret!, adapters: createProviderAdapters(env.ai) } };
  },
});
