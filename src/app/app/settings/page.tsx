import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceNotes } from "@/components/ui/page-guide";
import { SignOutForm } from "@/components/auth/sign-out-form";
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
  return <div className="product-page account-page"><PageHeader eyebrow="Your account / Privacy & control" title="Private by default." description="Manage your connected sign-in, confirm your identity and decide what happens to your private CarbonShift history." back={{href:"/app",label:"Your plans"}} />
    <div className="account-layout"><div className="account-main"><section className="settings-section"><h2>Connected account</h2><p className="account-email">{member.email ?? "Your connected account"}</p><p>Your CarbonShift plans are linked to this identity. Signing out ends this session; it does not delete your saved history or your Google or GitHub account.</p><SignOutForm className="button secondary" /></section>
    <section className="settings-section"><h2>Confirm your identity</h2><p>Use the same Google or GitHub account again before deleting a private plan or your CarbonShift account. This gives destructive actions a recent identity confirmation.</p>{reauthenticated ? <p className="notice" role="status">Identity confirmed recently. Deletion is available for ten minutes from confirmation.</p> : null}<ProviderSignIn unavailable={false} intent="reauth" /><p className="field-hint">Your provider may reuse an existing sign-in. CarbonShift requires a new provider exchange for the same account. Confirmation applies for ten minutes.</p></section></div>
    <aside className="account-context"><h2>Your routine,<br />under your control.</h2><ul><li><h3>Saved privately</h3><p>Your activity inputs, timing windows and reports stay in your private account unless you separately consent to a public copy.</p></li><li><h3>Published separately</h3><p>An exact preview shows which schedule, energy and timing details will become public. Publication is never required to use planning.</p></li><li><h3>Public copies remain</h3><p>Deleting private history removes account links. Already disclosed proof copies and blockchain records cannot be recalled.</p></li></ul><Link className="text-link" href="/privacy">Read the privacy details <span aria-hidden="true">↗</span></Link></aside></div>
    <AccountControls reauthenticated={reauthenticated} />
    <WorkspaceNotes title="Account access and appliance access are different." link={{href:"/methodology#boundaries",label:"Platform boundaries"}}><p>CarbonShift uses your provider identity to protect your saved records. It does not connect to a smart meter, control equipment, access your utility tariff or operate devices in your home.</p></WorkspaceNotes>
  </div>;
}
