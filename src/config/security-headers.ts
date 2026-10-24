function authFormSources(authUrl?: string): string {
  try {
    const url = new URL(authUrl ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return "";
    // Chromium applies form-action to the OAuth redirect chain as well as the
    // initial POST. These are public destinations, never provider credentials.
    return ` ${url.origin} https://accounts.google.com https://github.com`;
  } catch { return ""; }
}
export function securityHeaders(development: boolean, authUrl?: string) {
  const csp = [
    "default-src 'self'",
    // Next's streamed bootstrap uses inline scripts; evaluation is development-only.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${authFormSources(authUrl)}`,
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    // Native same-origin POST forms need an Origin for our CSRF check. A
    // no-referrer document policy makes Chromium send Origin: null instead.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ...(development ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  ];
}
