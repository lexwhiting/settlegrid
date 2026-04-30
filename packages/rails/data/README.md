# Stripe Connect Country Matrix — Refresh SOP

`stripe-connect-countries.json` is the canonical source of truth used by `routeDeveloper()` and `selectStripeAccountType()` in `packages/rails/src/router.ts` to decide whether a developer can onboard via Stripe Connect, and which account type (Express / Standard / Custom) to assign.

Stripe's supported-countries matrix changes roughly quarterly as Stripe expands its coverage. This file is **manually maintained** — there is no automated sync (the Stripe API does not expose the per-account-type country list). When Stripe adds or removes a country, follow the SOP below to update the JSON.

## Data shape

```jsonc
{
  "_meta": {
    "source": "https://stripe.com/global",
    "lastRefreshedAt": "YYYY-MM-DD",
    "refreshCadenceDays": 90,
    "refreshNotes": "..."
  },
  "express":  { "individualCountries": [...], "businessCountries": [...] },
  "standard": { "individualCountries": [...], "businessCountries": [...] },
  "custom":   { "individualCountries": [...], "businessCountries": [...] },
  "payoutCurrencies": [...]
}
```

- **`express.*Countries`** — countries where Stripe Connect Express is the default. Most developers land here.
- **`standard.*Countries`** — superset of Express. Standard supports a wider list. The router escalates a `scale`-tier developer with an explicit self-managed-disputes flag here when Express cannot serve them.
- **`custom.*Countries`** — countries that *require* Custom (rare, compliance-heavy). Empty in the current snapshot — populate only when Stripe's published matrix lists a country as Custom-only.
- **`payoutCurrencies`** — ISO-4217 codes Stripe Connect can pay out to a developer's bank.

ISO codes: `*Countries` use ISO-3166 alpha-2 (e.g., `US`, `GB`, `IN`); `payoutCurrencies` use ISO-4217 alpha-3 (e.g., `USD`).

## Refresh procedure

Run this every 90 days OR whenever Stripe announces a country expansion (subscribe to `https://stripe.com/blog`).

1. **Capture the current Stripe matrix.** Visit `https://stripe.com/global`. Stripe lists countries per Connect account type. Record the deltas (additions / removals) per `(accountType, entityType)` pair.
2. **Update the JSON.** Edit each affected list. Keep alphabetical order within a list (sort by ISO code) so diffs read cleanly.
3. **Bump `_meta.lastRefreshedAt`** to today (`YYYY-MM-DD`).
4. **Re-run tests:** `npm test --workspace=@settlegrid/rails`. The unit tests assert structural invariants (`standard ⊇ express`, every `custom` entry is also in `standard`, every country in any list is a 2-letter ISO code). A failed assertion means the new data violates a router invariant — fix the data, do not skip the assertion.
5. **Commit** with message `chore(rails): refresh Stripe country matrix YYYY-MM-DD` and a 1-2 sentence summary of what changed.
6. **Notify** the on-call founder. New Express coverage may unblock waitlisted developers — query `waitlist_signups` and consider an outbound email.

## What NOT to do

- Do **not** add a country to `express` without confirming Stripe Express actually supports that `(country, entity-type)` combination on Stripe's published page. Sending a developer to a Stripe Express form Stripe will reject is exactly the dead-end the router exists to prevent.
- Do **not** delete a country once added unless Stripe explicitly drops support — existing developers may have live Connect accounts pinned to that country and removing it from the matrix breaks their re-onboarding flow.
- Do **not** edit the JSON to "win" a router test. The JSON is the input; if a test fails after a refresh, the test is correct — investigate.

## Where waitlist signal data lives (Phase 5 telemetry contract)

The P3.RAIL1 spec says:

> Record the waitlist entry in the unified ledger's metadata so Phase 5 telemetry can use it.

**Interpretation:** the waitlist signal is recorded in `waitlist_signups.metadata` (jsonb), NOT inserted as a row in `ledger_entries`. The latter would be incorrect because:

- `ledger_entries` carries DB-enforced check constraints (`amount_cents > 0`, `entryType IN ('debit','credit')`, `settlement_status` in a closed enum) that a "waitlist signal" cannot satisfy without inventing a synthetic amount, account, and direction.
- A waitlist signup is a marketing/funnel event, not a financial event. Mixing the two would corrupt reconciliation queries that SUM `amount_cents` by category.

`waitlist_signups.metadata` carries the structured `{ countryIso, entityType, preferredCurrency, waitlistReason, feature, signedUpAt }` payload Phase 5 telemetry can join against. The shape is stable; downstream consumers depend on it.

If a future card needs the data IN `ledger_entries`, the migration is to add a synthetic `category: 'waitlist_signal'` value with relaxed amount/direction constraints — a schema change. Not in P3.RAIL1's scope.

## Why no automated sync

Stripe's REST API exposes per-account capability flags but does not publish the marketing-page "supported countries" list as a queryable endpoint. The matrix on `stripe.com/global` is editorial copy. Until Stripe ships an API for this, manual maintenance is the only honest source of truth.
