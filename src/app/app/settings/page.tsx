import { cookies, headers } from "next/headers";
import { pageContext } from "@/server/plans/page-context";
import { assertRecentReauth } from "@/server/auth/reauth";
import { databaseConfiguration } from "@/server/db/clients";
import { AccountControls } from "@/components/auth/account-controls";
import { ProviderSignIn } from "@/components/auth/provider-sign-in";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const { member } = await pageContext();
  const incoming = await headers(), jar = await cookies();
  let reauthenticated = false;
  try { await assertRecentReauth(new Request(databaseConfiguration().origin, { headers: { cookie: jar.toString(), "user-agent": incoming.get("user-agent") ?? "" } }), member); reauthenticated = true; } catch { /* Receipt missing or expired; confirmation remains available. */ }
  return <div className="planner-width"><header className="page-heading"><div><p className="eyebrow">Your account</p><h1>Private by default.</h1><p className="lead">Manage your sign-in and the washing plans you’ve saved.</p></div></header><section className="settings-section"><h2>Connected account</h2><p className="account-email">{member.email ?? "Your connected account"}</p><form action="/auth/sign-out" method="post"><button className="button secondary" type="submit">Sign out</button></form></section><section className="settings-section"><h2>Confirm your identity</h2><p>Sign in again with the same Google or GitHub account before deleting a private plan or your CarbonShift account.</p>{reauthenticated ? <p className="notice" role="status">Identity confirmed recently. Deletion is available for ten minutes from confirmation.</p> : null}<ProviderSignIn unavailable={false} intent="reauth" /><p className="field-hint">Your provider may reuse an existing sign-in. CarbonShift requires a new provider exchange for the same account.</p></section><AccountControls reauthenticated={reauthenticated} /></div>;
}
