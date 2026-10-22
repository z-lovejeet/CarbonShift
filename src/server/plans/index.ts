import "server-only";
import { requireMember } from "@/server/auth/session";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { gridClient } from "@/server/grid";
import { createPlanHandlers } from "./handlers";
import { createPlanRepository } from "./repository";
import { mutationIngress } from "@/server/limits/ingress";

export const planHandlers = createPlanHandlers({
  ingress: mutationIngress,
  async authenticate() {
    const member = await requireMember();
    return { userId: member.userId, repository: createPlanRepository(member.client, createServiceClient(), member.userId) };
  },
  origin: () => databaseConfiguration().origin,
  hmacSecret: () => databaseConfiguration().hmac,
  now: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  forecast: (range) => gridClient.getForecast(range),
});
