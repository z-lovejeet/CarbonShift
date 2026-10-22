import { requireMember } from "@/server/auth/session";
import { assertRecentReauth } from "@/server/auth/reauth";
import { createDeleteAccountHandler } from "@/server/auth/delete-account";
import { createServiceClient, databaseConfiguration } from "@/server/db/clients";
import { mutationIngress } from "@/server/limits/ingress";
import { ApiError } from "@/server/http/errors";
export const POST = createDeleteAccountHandler({
  origin: () => databaseConfiguration().origin, ingress: mutationIngress,
  async authenticate() {
    const member = await requireMember();
    return { userId: member.userId, reauthenticate: (request) => assertRecentReauth(request, member),
      async remove() { const result = await createServiceClient().auth.admin.deleteUser(member.userId); if (result.error && result.error.code !== "user_not_found") throw new ApiError("DELETE_UNAVAILABLE", 503, "Account deletion could not be confirmed. Retry after confirming your identity.", true); },
      async signOut() { await member.client.auth.signOut({ scope: "local" }); },
    };
  },
});
