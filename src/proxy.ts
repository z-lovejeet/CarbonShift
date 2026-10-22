import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/server/db/database.types";
import { getWebEnvironment } from "@/server/env";
import { boundedFetch } from "@/server/db/clients";

export async function proxy(request: NextRequest) {
  const env = getWebEnvironment();
  if (!env.database.configured) return NextResponse.redirect(new URL("/login", request.url));
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(env.database.url, env.database.publishableKey, {
    global: { fetch: boundedFetch },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: env.appOrigin?.startsWith("https:"), path: "/" },
    cookies: { getAll: () => request.cookies.getAll(), setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    } },
  });
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      redirect.headers.set("Cache-Control", "no-store");
      return redirect;
    }
  } catch { return NextResponse.redirect(new URL("/login?error=provider_unavailable", request.url)); }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/app/:path*"] };
