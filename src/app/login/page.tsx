import { SignOutForm } from "@/components/auth/sign-out-form";
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
  return <div className="product-page login-page"><section className="auth-layout" aria-labelledby="auth-title">
    <div className="auth-intro"><p className="eyebrow">Your account</p><h1 id="auth-title">{account ? "You’re signed in." : "A better time,\non your terms."}</h1>
      <p className="lead">{account ? "Your account is ready. Your plans will stay private unless you choose to publish." : "Sign in to save household schedules, compare your options and keep the assumptions and reports together."}</p>
      <ul className="auth-benefits"><li><h2>One activity or a whole routine</h2><p>Simulate device use, plan a few tasks or bring a complete London day together.</p></li><li><h2>Keep the reasoning with the plan</h2><p>Saved inputs, source data and later reports stay connected, with corrections kept in history.</p></li><li><h2>Choose what becomes public</h2><p>A private plan works on its own. Optional evidence publication always has its own review and consent.</p></li></ul><p className="auth-context">Current guidance uses Great Britain’s national grid signal.<br />No appliance is connected or controlled.</p>
    </div>
    <div className="auth-panel">
      {account ? <><h2>Welcome to CarbonShift</h2><p className="account-email">{account.email ?? "Your connected account"}</p><p>Your private plans are ready when you are. No appliance is connected or controlled.</p><Link href="/app" className="button auth-button">Go to your plans</Link><Link href="/app/settings" className="text-link">Account settings</Link><SignOutForm className="button auth-button" /></> : <><h2>Continue to CarbonShift</h2><p>Choose the account you’d like to use.</p>
        {failed ? <p role="alert" className="auth-notice">Sign-in wasn’t completed. You can try either provider again.</p> : null}
        {unavailable ? <p role="status" className="auth-notice">Account services are unavailable right now. Please try again later.</p> : null}
        <ProviderSignIn unavailable={unavailable} />
        <p className="auth-footnote">We use your connected account to keep your plans private. Publishing a receipt will always be a separate choice. <Link href="/privacy">Read how your data is handled.</Link></p></>}
      <Link className="nav-link" href="/">Back to CarbonShift</Link>
    </div>
  </section><div className="workspace-notes"><div><h2>Explore before you sign in.</h2><div className="workspace-notes-copy"><p>The labeled example, calculation methodology and local proof verifier are public. You can learn how the system works before creating private plans.</p></div></div><Link href="/demo" className="text-link">See an example <span aria-hidden="true">↗</span></Link></div></div>;
}
