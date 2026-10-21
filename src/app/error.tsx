"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="system-message" aria-labelledby="error-heading">
      <p className="eyebrow">Something interrupted this page</p>
      <h1 id="error-heading">Let’s try that again.</h1>
      <p>We couldn’t load this page. Try again, or return to the home page.</p>
      <div className="system-actions"><button className="button" onClick={reset}>Try again</button><Link href="/">Return home</Link></div>
    </section>
  );
}
