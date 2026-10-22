import { proofCookie, REAUTH_COOKIE, REAUTH_INTENT_COOKIE } from "@/server/auth/reauth-proof";
import { randomUUID } from "node:crypto";
import { createUserClient, databaseConfiguration } from "@/server/db/clients";
import { assertSameOrigin } from "@/server/http/request";
import { ApiError, publicFailure } from "@/server/http/errors";

export async function POST(request: Request) {
  try {
    const { origin } = databaseConfiguration();
    assertSameOrigin(request, origin);
    const client = await createUserClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error && error.name !== "AuthSessionMissingError") throw new ApiError("AUTH_UNAVAILABLE", 503, "Sign-out could not be confirmed. Try again.", true);
    const response = new Response(null, { status: 303, headers: { Location: `${origin}/login`, "Cache-Control": "no-store" } });
    for (const name of [REAUTH_COOKIE, REAUTH_INTENT_COOKIE]) response.headers.append("Set-Cookie", proofCookie(name, "", origin, true));
    return response;
  } catch (error) { return publicFailure(error, randomUUID()); }
}
