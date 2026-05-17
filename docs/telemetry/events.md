# Telemetry — canonical event registry

Single source of truth for the eight P4.1 launch-funnel events.
Anything firing into PostHog from SettleGrid surfaces MUST be on this
list and MUST conform to the documented payload. The proxy at
`/api/telemetry/capture` allow-lists against `EVENT_NAMES` from
`apps/web/src/lib/posthog.ts` — events not in this list are rejected
with HTTP 400.

## Surfaces

- **Browser** (gallery, template detail, shadow directory) — emitted
  via `posthog-js` directly. The provider at
  `apps/web/src/components/posthog-provider.tsx` initializes with
  `NEXT_PUBLIC_POSTHOG_KEY`.
- **CLI** (`@settlegrid/cli`, Node process) — emitted via
  `packages/settlegrid-cli/src/telemetry.ts`, which POSTs to the
  proxy at `https://settlegrid.ai/api/telemetry/capture`. The
  PostHog project key never ships in the CLI tarball.
- **Scaffolder** (`create-settlegrid-tool`, Node process) — emitted
  via `packages/create-settlegrid-tool/src/telemetry.ts`, a mirror
  of the CLI's. Shares the CLI's persistent distinct_id file
  (`~/.settlegrid/telemetry-id`) so a developer who runs both
  packages is one PostHog person. POSTs to the same proxy; no
  PostHog key ships in the tarball.
- **SDK** (`@settlegrid/mcp`, runs inside consumers' tool servers) —
  emitted via `packages/mcp/src/telemetry.ts`, which POSTs to the
  proxy at `${config.apiUrl}/api/telemetry/capture` (defaults to
  `https://settlegrid.ai`). Same constraint: no PostHog key shipped.

## `distinct_id` resolution

| Surface | distinct_id |
|---|---|
| Browser | PostHog's anonymous-cookie ID (managed by `posthog-js`) |
| CLI / `create-settlegrid-tool` | `SETTLEGRID_POSTHOG_ID` env var (the browser → CLI handoff) when set to a valid UUID, else a random UUID written to `~/.settlegrid/telemetry-id` (mode 0600) on first run |
| SDK | `sha256(toolSlug)` — anonymous, deterministic per tool |

## Opt-out

- **CLI / SDK**: set `SETTLEGRID_TELEMETRY=0` (also accepts `false`,
  `no`, `off`). The CLI postinstall hook respects the same env var.
- **Browser**: clear cookies, or PostHog respects DNT when the
  browser sends it.
- **Operator-side**: unset `POSTHOG_API_KEY` and `NEXT_PUBLIC_POSTHOG_KEY`
  on the web app deployment — the proxy returns 200 with `{ ok: true,
  forwarded: false, reason: 'telemetry_disabled' }` so clients don't
  retry-loop, and the client-side capture is a no-op.

## Server-side enrichment

Every event captured through `/api/telemetry/capture` is enriched
server-side with two properties before forwarding to PostHog:

| Property | Source |
|---|---|
| `ip_country` | `x-vercel-ip-country` request header (Vercel injects). Falls back to `'XX'` when absent. |
| `received_at` | ISO-8601 timestamp at proxy receive time. |

These are added even if the client supplied them, so spoofing is
not possible.

## Wire shape (CLI/SDK → proxy)

```jsonc
POST /api/telemetry/capture
Content-Type: application/json

{
  "event": "scaffold_success",
  "properties": { "template_slug": "neon-mcp", "duration_ms": 1234 },
  "distinct_id": "9c3a8f12-..."
}
```

Validation (Zod): `event` ∈ `EVENT_NAMES`, `properties` is an object
of ≤ 4 KB serialized JSON, `distinct_id` is a non-empty string of
length ≤ 256.

## Wire shape (proxy → PostHog)

```jsonc
POST {NEXT_PUBLIC_POSTHOG_HOST}/i/v0/e/
Content-Type: application/json

{
  "api_key": "phc_...",
  "event": "scaffold_success",
  "distinct_id": "9c3a8f12-...",
  "properties": {
    "template_slug": "neon-mcp",
    "duration_ms": 1234,
    "ip_country": "US",
    "received_at": "2026-04-26T18:12:34.567Z"
  },
  "timestamp": "2026-04-26T18:12:34.567Z"
}
```

## The eight canonical events

### 1. `gallery_viewed`
- **Surface:** Browser, on `/templates` mount
- **Properties:** *(none required)*
- **distinct_id:** PostHog anonymous ID
- **Funnel role:** Top-of-funnel — visitor saw the gallery.

### 2. `template_detail_viewed`
- **Surface:** Browser, on `/templates/[slug]` mount
- **Properties:** `{ slug: string, category: string }`
- **distinct_id:** PostHog anonymous ID
- **Funnel role:** Interest signal — visitor drilled into a specific template.

### 3. `shadow_directory_viewed`
- **Surface:** Browser, on `/mcp/[owner]/[repo]` mount
- **Properties:** `{ owner: string, repo: string, has_claim: boolean }`
- **distinct_id:** PostHog anonymous ID
- **Funnel role:** SEO-discovery surface — visitor landed on an indexed shadow page.

### 4. `cli_install_started`
- **Surface:** CLI / `create-settlegrid-tool`, on the postinstall hook
- **Properties:** `{ cli_version: string, node_version: string, os: string }`
- **distinct_id:** CLI persistent UUID
- **Funnel role:** Activation — developer installed the CLI binary.

### 5. `scaffold_success`
- **Surface:** CLI, after a successful `settlegrid add` run; or
  `create-settlegrid-tool`, after a successful scaffold run
- **Properties:** `{ template_slug: string, duration_ms: number }`
- **distinct_id:** CLI persistent UUID
- **Funnel role:** Activation — developer wrapped a real repo with monetization.

### 6. `scaffold_failed`
- **Surface:** CLI, on any error path of `settlegrid add`; or
  `create-settlegrid-tool`, on any error path of a scaffold run
- **Properties:** `{ template_slug: string, error_code: string }`
- **distinct_id:** CLI persistent UUID
- **Funnel role:** Drop-off — diagnostic for what's blocking activation. `error_code` is one of — from `@settlegrid/cli`: `unknown_repo_type`, `transform_error`, `pr_failed`, `resolve_error`, `unknown`; from `create-settlegrid-tool`: `template_not_found`, `download_failed`, `write_failed`, `unknown`.

### 7. `sdk_first_init`
- **Surface:** SDK, on the first `settlegrid.init()` per process+toolSlug
- **Properties:** `{ sdk_version: string, org_id_hash: string }`
- **distinct_id:** `sha256(toolSlug)`
- **Funnel role:** Activation — developer's tool server actually loaded the SDK.

### 8. `first_billed_call`
- **Surface:** SDK, on the first successful `meter()` per process+toolSlug+consumerId
- **Properties:** `{ method: string, amount_cents: number }`
- **distinct_id:** `sha256(toolSlug)`
- **Funnel role:** Revenue — first paid invocation. The conversion event.

## Hostile-lens invariants on this proxy

- Allow-list event names — arbitrary events MUST NOT proxy.
- `properties` size capped (≤ 4 KB serialized) to prevent abuse.
- `distinct_id` length capped (≤ 256 chars).
- `ip_country` / `received_at` stamped server-side; client-supplied
  values overwritten.
- Rate-limited 60 req/min per IP via the same Upstash sliding window
  used by `/api/waitlist`.
- Proxy never echoes `distinct_id` or PostHog response body in 4xx /
  5xx (no info leak, no oracle).
- `posthog-js` and the proxy are the ONLY two paths that contact
  PostHog. The published CLI/SDK tarballs MUST NOT contain
  `phc_*` strings — verified by `npm pack && tar -xf | grep`.
