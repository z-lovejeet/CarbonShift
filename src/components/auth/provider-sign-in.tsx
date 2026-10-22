"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Provider = "google" | "github";
const providerName = (provider: Provider) => provider === "google" ? "Google" : "GitHub";

export function ProviderSignIn({ unavailable, intent }: { unavailable: boolean; intent?: "reauth" }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    // A browser back/forward-cache restore must not leave the sign-in forms disabled.
    const restore = () => { submitting.current = false; setPending(null); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  function begin(event: FormEvent<HTMLFormElement>, provider: Provider) {
    if (submitting.current || unavailable) { event.preventDefault(); return; }
    submitting.current = true;
    setPending(provider);
  }
  return <>
    <div className="auth-options">{(["google", "github"] as const).map((provider) => <form action="/auth/sign-in" method="post" key={provider} onSubmit={(event) => begin(event, provider)}>
      <input type="hidden" name="provider" value={provider} />{intent ? <input type="hidden" name="intent" value={intent} /> : null}
      <button className="button provider-button" disabled={unavailable || pending !== null} type="submit">
        {pending === provider ? `Opening ${providerName(provider)}…` : `${intent ? "Confirm" : "Continue"} with ${providerName(provider)}`}<span aria-hidden="true">↗</span>
      </button>
    </form>)}</div>
    {pending ? <p className="auth-progress" role="status">Opening {providerName(pending)} sign-in. Please wait.</p> : null}
  </>;
}
