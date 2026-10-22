import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/server/db/clients";
import type { Json } from "@/server/db/database.types";
import { ApiError } from "@/server/http/errors";
import type { Budget } from "./budgets";

export async function reserveUsage(budgets: Budget[]) {
  const r = await createServiceClient().rpc("cs_reserve_usage", { p_operation: randomUUID(), p_buckets: budgets as unknown as Json });
  const parsed = z.object({ allowed: z.boolean(), retryAfter: z.number().int().min(0).max(172800) }).safeParse(r.data);
  if (r.error || !parsed.success) throw new ApiError("SERVICE_UNAVAILABLE", 503, "This service is temporarily unavailable. Your fields are kept here.", true);
  if (!parsed.data.allowed) throw new ApiError("RATE_LIMITED", 429, "Several requests arrived recently. Please wait before trying again.", true, parsed.data.retryAfter);
}
