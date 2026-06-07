# Changelog

All notable changes to `@settlegrid/mcp`.

## 0.3.0 — 2026-06-06

Security release. The metering call now authenticates.

### Changed
- **`/meter` is now authenticated.** `sg.wrap()`, `sg.meter()`, and the dispatch kernel now send the
  consumer API key as an `X-Api-Key` header on the metering request. The SettleGrid server (F2) hashes
  it, looks up the active key, and rejects any request whose `consumerId`/`toolId`/`keyId` does not
  belong to the presented key — closing an unauthenticated metering / credit-attribution gap.
- **Requires a SettleGrid server with F2 deployed.** Against such a server an older SDK (`< 0.3.0`) that
  does not send the header receives `401` on `/meter`; metering is fire-and-forget, so the tool call
  still returns, but the invocation is not billed/recorded. Upgrade to keep metering working.

## 0.2.0 — 2026-05-27

Additive release; no breaking changes from `0.1.1`. Same `settlegrid.init()` + `sg.wrap()` core API.

### Added
- **Template-manifest schema.** Zod schema + generated JSON Schema for the
  gallery `template.json` shape. Exported from the main barrel as
  `templateManifestSchema`, `validateTemplateManifest`, and
  `safeValidateTemplateManifest`; the JSON Schema ships at
  `schemas/template.schema.json` for non-Node consumers.
- **Per-method pricing** in template manifests. Optional
  `pricing.methods` map (`{ costCents, displayName?, unitType? }`) that
  mirrors the per-method pricing the SDK already meters on, so the
  gallery surface no longer flattens to a single number.
- **`createDispatchKernel`** — cross-protocol settlement dispatch,
  exported from the main barrel and (as an alias) from `./kernel`. Lets
  consumers compose adapters for multiple agent payment protocols
  through one settlement entry point.
- **Kernel telemetry.** Structured event emission for kernel dispatch
  with a configurable server-side capture endpoint.
- **Subpath exports `./rest` and `./kernel`** (both aliased to the main
  barrel). `import { settlegridMiddleware } from '@settlegrid/mcp/rest'`
  and `import { createDispatchKernel } from '@settlegrid/mcp/kernel'`
  both resolve cleanly. The type surface today is the full barrel; a
  future minor version may split it for finer tree-shaking.
- **Protocol-adapter surface** — detection + dispatch for MCP, x402,
  AP2, L402, ACP, UCP, MPP, Circle Nano, EMVCo, Alipay, KyaPay, Drain.

### Experimental — detection-only stubs
Two adapters are wired for protocol detection but throw on actual
invocation. They are present so MCP / x402 / SettleGrid clients can
**detect** these rails end-to-end, but production traffic should treat
them as not-yet-available:

- **Visa TAP** (`@settlegrid/mcp` → `protocolRegistry.tap`) — requires
  Visa sandbox access. `run()` throws
  `"Visa TAP integration is not yet available."`
- **Mastercard Verifiable Intent**
  (`protocolRegistry['mastercard-vi']`) — detection stub. `run()` throws
  until the full integration lands.

### Notes
- The unscoped `settlegrid` CLI package (formerly `@settlegrid/cli`)
  publishes separately at 0.2.0. `npx settlegrid add` is now the
  canonical command.
- Template-pin bump from `^0.1.1` → `^0.2.0` for `scripts/gen/core.mjs`
  and the four `create-settlegrid-tool` templates lands in a follow-up
  commit after this release.

## 0.1.1

Initial public release.
