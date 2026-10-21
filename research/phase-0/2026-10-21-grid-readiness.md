# M00.04 — public grid-feed readiness evidence

Reviewed 21 October 2026 in Asia/Kolkata. The unauthenticated HTTPS request completed at `2026-10-20T20:43:42Z` (21 October, 02:13:42 IST). This is a research observation, not the application adapter or a live planning result.

## Request and retained evidence

- Source: [NESO national 48-hour request](https://api.carbonintensity.org.uk/intensity/2026-10-20T20:30Z/fw48h).
- [Exact response bytes](2026-10-21-grid-response.json), with no normalization or substituted values.
- [Observation metadata and SHA-256](2026-10-21-grid-observation.json).
- Attribution: NESO Carbon Intensity API, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Endpoint and license are documented in the [official quick-start](https://api.carbonintensity.org.uk/).

## Observed checks

HTTP 200 returned JSON containing 97 ordered contiguous half-hours from `2026-10-20T20:00Z` through `2026-10-22T20:30Z`. Every interval lasted 1,800 seconds; all forecast factors were nonnegative integers. Coverage included the requested 48-hour span and an additional leading interval. There were 96 null actual factors, which remain null. No interval-validation issues were observed. The response did not provide a provider issuance timestamp; it remains unknown.

Document 07 records the adapter consequence: validate actual timestamps/coverage instead of assuming exactly 96 rows. A complete response at this observation does not promise later availability or an unconditional 48-hour horizon from any later comparison time. Cached copies cannot be passed off as a fresh live feed.

## Limits

No scheduler, cache, database, provider retry policy, UI, or product API was implemented/tested by this probe. M03 still must build and validate the adapter, replay/failure tests, and a fresh real read. This dated snapshot is public research evidence and may later inform explicitly labeled test fixtures.
