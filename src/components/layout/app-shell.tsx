import Link from "next/link";
import { MobileNavigation } from "./mobile-navigation";
import { PrimaryNavigation } from "./primary-navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="wordmark" href="/" aria-label="CarbonShift home">CarbonShift<span aria-hidden="true">.</span></Link>
          <PrimaryNavigation />
          <MobileNavigation />
        </div>
      </header>
      <main className="shell main-content" id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-inner"><p>Everyday energy, considered.</p><nav aria-label="About CarbonShift"><Link href="/methodology">Methodology</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/verify">Verify a proof</Link> · <Link href="/demo">Example</Link></nav><p>Great Britain · Europe/London</p></div>
      </footer>
    </div>
  );
}
