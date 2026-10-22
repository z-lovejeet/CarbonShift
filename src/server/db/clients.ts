import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getWebEnvironment } from "@/server/env";
import type { Database } from "./database.types";
import { ApiError } from "@/server/http/errors";

export const boundedFetch: typeof fetch = (input, init) => fetch(input, {
  ...init, cache: "no-store", redirect: "error", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
});
export function databaseConfiguration() {
  const environment = getWebEnvironment();
  if (!environment.database.configured) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Account services are unavailable. Please try again.", true);
  return { ...environment.database, origin: environment.appOrigin!, hmac: environment.rateLimitHmacSecret! };
}
export async function createUserClient() {
  const config = databaseConfiguration(), store = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
    global: { fetch: boundedFetch },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: config.origin.startsWith("https:"), path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        // Route handlers/proxy persist refreshes; React server components cannot write cookies.
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Read-only render. */ }
      },
    },
  });
}
export function createServiceClient() {
  const config = databaseConfiguration();
  if (!config.secretKey) throw new ApiError("DATABASE_UNAVAILABLE", 503, "Account services are unavailable. Please try again.", true);
  return createClient<Database>(config.url, config.secretKey, { global: { fetch: boundedFetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
