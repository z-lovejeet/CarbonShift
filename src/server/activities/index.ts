import "server-only";
import { requireMember } from "@/server/auth/session";
import { databaseConfiguration } from "@/server/db/clients";
import { gridClient } from "@/server/grid";
import { requestBudget, subject } from "@/server/limits/budgets";
import { reserveUsage } from "@/server/limits/store";
import { mutationIngress } from "@/server/limits/ingress";
import { createActivityHandlers } from "./handlers";

export const activityHandlers = createActivityHandlers({
  origin: () => databaseConfiguration().origin, requireMember, sources: gridClient,
  nowUtc: () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  async admit(userId) {
    await mutationIngress(userId);
    const config = databaseConfiguration();
    await reserveUsage([requestBudget(`simulation:${subject(config.hmac, "simulation", userId)}`, 20, new Date().toISOString(), 60)]);
  },
});
