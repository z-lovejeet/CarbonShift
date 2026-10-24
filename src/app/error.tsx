"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="system-message product-page" aria-labelledby="error-heading"><p className="eyebrow">Something interrupted this page</p><h1 id="error-heading">Let’s try that again.</h1><p>We couldn’t load this page. Try again, or return home to choose another workspace.</p><div className="system-actions"><button className="button" onClick={reset}>Try again</button><Link className="text-link" href="/">Return home</Link></div><div className="system-context">A page-loading error is not confirmation that a save, report or publication succeeded or failed. If you were submitting an action, reopen the saved record to inspect its current status before creating another request.</div></section>;
}
