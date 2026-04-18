# Country Tracker — Cold-Email Outreach + Stripe Corridor Coverage

**Document owner:** SettleGrid (Alerterra, LLC)
**Source of truth for:** Stripe corridor coverage; country-level cold-email enrichment schema; the "Stripe-unsupported-corridor waitlist" segment definition.
**Cadence:** reviewed monthly alongside the Stripe corridor matrix; updated whenever Stripe adds/removes a country from its Connect list.

---

## Why this file exists

Two problems converge into one source of truth:

1. **Cold-email prospects need country tagging.** When a positive response comes in from a Stripe-unsupported country, that contact routes to the waitlist segment rather than the activate-now segment. Without `country_iso` + `stripe_supported` on every contact, we either miss those waitlist candidates or waste activation-touch cycles on people who can't actually onboard.

2. **The cohort-1 enumeration is load-bearing.** Phase-2 gate check 20 asks for "the cohort-1 countries enumerated" — that list is the target set of high-signal Stripe-unsupported corridors where SettleGrid expects to see the highest waitlist volume. Defining it here (not in a buried paragraph of the master plan) lets the waitlist segmentation, the Wise stopgap SOP, and the Phase-3 second-rail decision criteria all point at one definition.

---

## 1. Cold-email outreach schema

Every prospect row in the outreach tracker (Instantly.ai or equivalent) carries at least these fields:

| Field | Type | Notes |
|---|---|---|
| `email` | string | Required. Contact email. |
| `first_name` | string | Required for personalization merge tags. |
| `company` | string | Organization if known. |
| `role` | string | "founder", "developer", "PM", etc. |
| `github_url` | string | Where available — drives the country backfill heuristic (§3). |
| `domain` | string | Primary domain (email domain or company site). Drives the fallback backfill heuristic. |
| **`country_iso`** | **ISO-3166 α-2** | **Added P2.INTL1.** Canonical country assignment. `UNKNOWN` when neither heuristic yields a match. |
| **`stripe_supported`** | **bool \| `unknown`** | **Added P2.INTL1.** Derived from `country_iso` × Stripe's Connect-supported list (§2). `unknown` when `country_iso` = `UNKNOWN`. |
| `segment` | enum | `activate-now`, `stripe-unsupported-corridor-waitlist`, `cold`, `bounced`, `opted-out`. See §4. |
| `source` | string | Where the prospect came from (GitHub scrape, HN, referral, etc.). |
| `last_touch_at` | date | Most recent send or reply. |

Existing trackers without `country_iso` and `stripe_supported` fields MUST be backfilled per §3 before the waitlist segment is used.

---

## 2. Stripe Connect supported countries

The authoritative set is maintained in `packages/mcp/src/rails/stripe-connect.ts` (`STRIPE_CONNECT_CAPABILITIES.individualCountries` + `businessCountries`). As of 2026-04-18, 43 countries:

```
AU AT BE BR BG CA HR CY CZ DK EE FI FR DE GI GR HK HU IN IE IT JP
LV LI LT LU MT MX NL NZ NO PL PT RO SG SK SI ES SE CH TH AE GB US
```

A prospect's `stripe_supported` is `true` iff `country_iso` is in this set. Update this document (AND the Stripe adapter's `STRIPE_CONNECT_CAPABILITIES`) whenever Stripe publishes a Connect-coverage change.

**Updating procedure:** edit the constant in `packages/mcp/src/rails/stripe-connect.ts`, bump this document's set, re-run a backfill pass (§3) over the outreach tracker to flip any flipped prospects.

---

## 3. Backfill heuristic

Existing prospects without a `country_iso` value are backfilled by running both heuristics and taking the first hit:

1. **GitHub location heuristic.** If `github_url` is populated: fetch the user's public `location` field from the GitHub API. Parse with a country-name library (e.g., `i18n-iso-countries`). If the location parses to a valid ISO-3166 α-2, use that.

2. **Domain TLD heuristic.** If no GitHub location or GitHub yielded no valid parse: use the country code implied by the email/company domain's ccTLD. For generic TLDs (`.com`, `.ai`, `.dev`), skip this heuristic rather than guessing US.

3. **Unknown.** If neither heuristic resolves, set `country_iso = UNKNOWN`. These rows STAY in the `cold` segment — they're not routed to either activate-now or waitlist until a country is known (typically via the prospect replying with location info).

A script that batches this backfill lives at `scripts/outreach/backfill-country.ts` (to be created when the first outreach campaign lands — today the tracker is pre-populated with the schema but has no live prospects).

---

## 4. Segments + routing

Instantly (or equivalent cold-email tool) carries these segments. Positive-reply routing happens at reply-review time by the founder or an operator:

| Segment | Criteria | Action on positive reply |
|---|---|---|
| `activate-now` | `stripe_supported = true` AND not opted-out | Send the activation sequence: Stripe Connect onboarding link + docs link. Developer can fully self-serve. |
| `stripe-unsupported-corridor-waitlist` | `stripe_supported = false` AND opted-in to waitlist | Send the waitlist-confirmation email explaining the corridor limitation + Wise-stopgap option (§5) + timeline for second-rail evaluation. Record in `data/international/waitlist.csv` (append-only) with `email`, `country_iso`, `date_added`, `source_thread_id`. |
| `cold` | Not yet replied OR `country_iso = UNKNOWN` | Continue the sequence per Instantly's default cadence. |
| `bounced` / `opted-out` | Hard-bounce or unsubscribe | No further sends. Retain only for suppression. |

**Note on segment naming.** The spec for P2.INTL1 was revised on 2026-04-14 — the original segment was `polar-q2-waitlist`, tied to the Pattern-C Polar integration. Pattern A+ abandoned Polar; the replacement segment is `stripe-unsupported-corridor-waitlist`. Existing Instantly lists created under the old name must be renamed or archived.

---

## 5. Cohort 1 — the Stripe-unsupported corridors we're tracking most actively

These are the countries where SettleGrid expects the highest waitlist volume based on GitHub developer density + AI-tool-author activity, and where Stripe Connect does NOT currently support payouts:

| ISO | Country | Rationale | Wise stopgap viable? |
|---|---|---|---|
| PK | Pakistan | High developer density; Stripe has no Connect support | Yes — Wise supports PKR payouts |
| NG | Nigeria | Large AI/dev community; Stripe Connect unsupported | Yes — Wise supports NGN payouts |
| BD | Bangladesh | Growing dev community; Stripe Connect unsupported | Yes (BDT limited) |
| VN | Vietnam | Active AI builder community; Stripe Connect limited | Yes — Wise supports VND |
| PH | Philippines | Strong Discord/OSS presence; Stripe Connect unsupported | Yes — Wise supports PHP |
| ID | Indonesia | Large developer market; Stripe Connect unsupported | Yes — Wise supports IDR |
| KE | Kenya | Africa hub; Stripe Connect unsupported | Yes — Wise supports KES |
| GH | Ghana | Adjacent to KE; Stripe Connect unsupported | Partial — Wise limited in GH |
| UA | Ukraine | Active OSS community; Stripe Connect restricted | Partial — sanctions-sensitive |
| TR | Turkey | Stripe Connect restrictions | Yes — Wise supports TRY |

**Use:** this is the target list for waitlist-volume monitoring. When cumulative waitlist opt-ins from this cohort crosses the threshold defined in `docs/sops/manual-wise-payouts.md` §"Second-rail decision criteria", the second-rail evaluation (Paddle / Lemon Squeezy / Wise Business API) gets prioritized into the next phase.

**Note:** India (IN) is NOT in cohort 1 — Stripe Connect DOES support India as an individual-country payout destination. Indian developers go through the standard Stripe Connect flow, not the Wise stopgap.

---

## 6. Change log

| Date | Change |
|---|---|
| 2026-04-18 | File created under P2.INTL1. Schema defined; cohort 1 enumerated; backfill heuristic documented; segment renamed from `polar-q2-waitlist` (Pattern C, superseded) to `stripe-unsupported-corridor-waitlist` (Pattern A+). No live prospects yet — backfill runs against the first real outreach campaign. |
