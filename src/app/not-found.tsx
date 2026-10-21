import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="system-message" aria-labelledby="not-found-heading">
      <p className="eyebrow">Page not found</p>
      <h1 id="not-found-heading">This page isn’t here.</h1>
      <p>The link may have changed. You can return home to find your way.</p>
      <Link className="button" href="/">Return home</Link>
    </section>
  );
}
