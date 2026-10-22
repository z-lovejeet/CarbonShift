import Link from "next/link";
import { MobileNavigation } from "./mobile-navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="wordmark" href="/" aria-label="CarbonShift home">CarbonShift<span aria-hidden="true">.</span></Link>
          <nav className="desktop-navigation" aria-label="Primary navigation">
            <Link href="/app" className="nav-link">Plans</Link>
            <Link href="/demo" className="nav-link">Example</Link>
            <Link href="/app/settings" className="nav-link">Account</Link>
          </nav>
          <MobileNavigation />
        </div>
      </header>
      <main className="shell main-content" id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-inner"><p>Everyday energy, considered.</p><p>Great Britain · Europe/London</p></div>
      </footer>
    </div>
  );
}
