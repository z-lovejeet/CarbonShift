import "server-only";
import { z } from "zod";
import { createUserClient } from "@/server/db/clients";
import { ApiError } from "@/server/http/errors";

export async function requireMember() {
  const client = await createUserClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    if (error && ![400, 401, 403].includes(error.status ?? 0) && error.name !== "AuthSessionMissingError") throw new ApiError("AUTH_UNAVAILABLE", 503, "Sign-in services are temporarily unavailable.", true);
    throw new ApiError("UNAUTHENTICATED", 401, "Sign in to continue.");
  }
  const userId = z.uuid().parse(data.user.id);
  return { userId, client, email: data.user.email ?? null };
}
