import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/server/db/schema";
import { ApiError } from "@/server/http/errors";

export function authorizeMaintenance(request: Request, secret: string | null) {
  if (!secret || secret.length < 32) throw new ApiError("SERVICE_UNAVAILABLE", 503, "Maintenance is not configured.");
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(provided), expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new ApiError("UNAUTHENTICATED", 401, "A maintenance credential is required.");
  }
}
export async function runMaintenance(client: SupabaseClient<Database>, apply: boolean) {
  const response = await client.rpc("cs_retention", { p_apply: apply });
  if (response.error) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Maintenance could not be completed. Retry later.", true);
  return z.object({ busy: z.boolean() }).passthrough().parse(response.data);
}
