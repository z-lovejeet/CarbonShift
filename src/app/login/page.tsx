import Link from "next/link";
import { ProviderSignIn } from "@/components/auth/provider-sign-in";
import { getWebEnvironment } from "@/server/env";
import { requireMember } from "@/server/auth/session";
import { ApiError } from "@/server/http/errors";

export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const configured = getWebEnvironment().database.configured;
  let account: { email: string | null } | null = null, unavailable = !configured;
  if (configured) {
    try { account = await requireMember(); }
    catch (error) { if (!(error instanceof ApiError) || error.status !== 401) unavailable = true; }
  }
  const query = await searchParams;
  const failed = ["sign_in_failed", "provider_unavailable"].includes(String(query.error));
  return <section className="auth-layout" aria-labelledby="auth-title">
    <div className="auth-intro"><p className="eyebrow">Your account</p><h1 id="auth-title">{account ? "You’re signed in." : "A better time,\non your terms."}</h1>
      <p className="lead">{account ? "Your account is ready. Your plans will stay private unless you choose to publish." : "Sign in to save a washing plan and keep the assumptions behind it."}</p>
      <p className="auth-context">Great Britain’s national grid signal.<br />Your routine. Your choice.</p>
    </div>
    <div className="auth-panel">
      {account ? <><h2>Welcome to CarbonShift</h2><p className="account-email">{account.email ?? "Your connected account"}</p><p>Your private plans are ready when you are. No appliance is connected or controlled.</p><Link href="/app" className="button auth-button">Go to your plans</Link><Link href="/app/settings" className="text-link">Account settings</Link><form action="/auth/sign-out" method="post"><button className="button auth-button" type="submit">Sign out</button></form></> : <><h2>Continue to CarbonShift</h2><p>Choose the account you’d like to use.</p>
        {failed ? <p role="alert" className="auth-notice">Sign-in wasn’t completed. You can try either provider again.</p> : null}
        {unavailable ? <p role="status" className="auth-notice">Account services are unavailable right now. Please try again later.</p> : null}
        <ProviderSignIn unavailable={unavailable} />
        <p className="auth-footnote">We use your connected account to keep your plans private. Publishing a receipt will always be a separate choice.</p></>}
      <Link className="nav-link" href="/">Back to CarbonShift</Link>
    </div>
  </section>;
}
