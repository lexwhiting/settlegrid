# Template Audit Report — run-2026-04-19T17-12-16-397Z

**Started:** 2026-04-19T17:12:16.397Z  
**Completed:** 2026-04-19T17:17:41.483Z  
**Duration:** 325.1s  
**Total templates audited:** 1022

## Verdict distribution

| Verdict | Count | % |
|---|---|---|
| KEEP | 882 | 86.3% |
| REVIEW | 52 | 5.1% |
| REMOVE | 88 | 8.6% |

## Meta-audit

- Overall: **PASS**
- Rule fixture checks: 26 rules validated
- Dead rules (never fired on corpus): structural:package-json-valid, structural:slug-match, structural:tsconfig-valid, structural:license-non-empty, pollution:placeholder-survival, sdk:import-present, sdk:init-called, sdk:wraps-at-least-one-handler, metadata:keywords-sufficient, metadata:description-substance, metadata:license-field, metadata:repository-field, metadata:no-unpinned-deps, manifest:template-json-valid, originality:duplicate-server, originality:duplicate-readme
- Verdict invariant: sumMatchesTotal=true, everyTemplateHasVerdict=true
- Determinism: runTwicePassed=true (diffs: 0)

## Top failure clusters

| Rule | Severity | Count |
|---|---|---|
| `executable:tsc-compile` | high | 129 |
| `sdk:pricing-default-cost` | high | 86 |
| `content:external-fetch-or-data` | medium | 70 |
| `content:readme-substance` | low | 46 |
| `content:server-line-count` | medium | 25 |
| `structural:required-files` | high | 15 |
| `content:input-validation-throws` | low | 10 |
| `pollution:python-ternary` | fatal | 4 |
| `sdk:tool-slug-matches-dir` | medium | 2 |
| `pollution:scaffold-markers` | medium | 2 |

## Rule activation counts

| Rule | Times fired |
|---|---|
| `executable:tsc-compile` | 129 |
| `sdk:pricing-default-cost` | 86 |
| `content:external-fetch-or-data` | 70 |
| `content:readme-substance` | 46 |
| `content:server-line-count` | 25 |
| `content:input-validation-throws` | 10 |
| `structural:required-files` | 5 |
| `pollution:python-ternary` | 4 |
| `pollution:scaffold-markers` | 2 |
| `sdk:tool-slug-matches-dir` | 2 |
| `structural:package-json-valid` | 0 |
| `structural:slug-match` | 0 |
| `structural:tsconfig-valid` | 0 |
| `structural:license-non-empty` | 0 |
| `pollution:placeholder-survival` | 0 |
| `sdk:import-present` | 0 |
| `sdk:init-called` | 0 |
| `sdk:wraps-at-least-one-handler` | 0 |
| `metadata:keywords-sufficient` | 0 |
| `metadata:description-substance` | 0 |
| `metadata:license-field` | 0 |
| `metadata:repository-field` | 0 |
| `metadata:no-unpinned-deps` | 0 |
| `manifest:template-json-valid` | 0 |
| `originality:duplicate-server` | 0 |
| `originality:duplicate-readme` | 0 |

## REMOVE candidates (sample)

### `adafruit-io` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 55: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `adsb-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 82: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `ais-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 78: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `altmetric` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 68: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `arduino-cloud` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 83: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `banking-rates` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 31: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `bioarxiv` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 54: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `biofuel` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 74: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `bond-yields` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 29: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `cds-spreads` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 33: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `cell-tower` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 72: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `code-reviewer` (confidence 0.90)
- 3 HIGH findings: structural:required-files, structural:required-files, structural:required-files
  - **high** `structural:required-files`: missing required file: README.md
    - evidence: README.md
  - **high** `structural:required-files`: missing required file: Dockerfile
    - evidence: Dockerfile
  - **high** `structural:required-files`: missing required file: LICENSE
    - evidence: LICENSE

### `commodity-futures` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 72: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `commodity-prices` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 65: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `core-api` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 60: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `credit-card` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 37: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `crop-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 67: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `crowdfunding` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 50: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `data-enrichment` (confidence 0.90)
- 3 HIGH findings: structural:required-files, structural:required-files, structural:required-files
  - **high** `structural:required-files`: missing required file: README.md
    - evidence: README.md
  - **high** `structural:required-files`: missing required file: Dockerfile
    - evidence: Dockerfile
  - **high** `structural:required-files`: missing required file: LICENSE
    - evidence: LICENSE

### `datacite` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 64: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `dimensions` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 60: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `dividend-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 65: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `doaj` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 70: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `earnings-calendar` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 73: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `economic-calendar` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 85: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `encoding` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: defaultCostCents must be ≥1, got 0
    - evidence: src/server.ts  
    `defaultCostCents: 0`
  - **high** `executable:tsc-compile`: tsc failed with 3 error(s); first: 51: Property 'byteLength' does not exist on type 'typeof Buffer'.
    - evidence: src/server.ts

### `etf-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 45: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `europe-pmc` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 59: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `farm-subsidies` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 58: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `fatcat` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 72: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `fisheries` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 60: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `food-prices` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 63: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `futures-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 44: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `gdp-data` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 43: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `google-scholar` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 60: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `ham-radio` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 88: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `hebrew-calendar` (confidence 1.00)
- 1 FATAL finding(s): pollution:python-ternary
  - **fatal** `pollution:python-ternary`: Python-style ternary in src/server.ts:57
    - evidence: src/server.ts:57  
    `const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}`
  - **medium** `content:external-fetch-or-data`: server.ts has no fetch() call and only 8 data-entry lines — appears to be a hollow handler chain
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 15 error(s); first: 57: ':' expected.
    - evidence: src/server.ts

### `image-classifier` (confidence 0.90)
- 4 HIGH findings: structural:required-files, structural:required-files, structural:required-files…
  - **high** `structural:required-files`: missing required file: README.md
    - evidence: README.md
  - **high** `structural:required-files`: missing required file: Dockerfile
    - evidence: Dockerfile
  - **high** `structural:required-files`: missing required file: LICENSE
    - evidence: LICENSE

### `inflation` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 34: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `insider-trading` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 68: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `institutional` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 6 error(s); first: 41: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `insurance-rates` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 35: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `ipo-calendar` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 62: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `irrigation` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 64: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `islamic-calendar` (confidence 1.00)
- 1 FATAL finding(s): pollution:python-ternary
  - **fatal** `pollution:python-ternary`: Python-style ternary in src/server.ts:60
    - evidence: src/server.ts:60  
    `const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}`
  - **medium** `content:external-fetch-or-data`: server.ts has no fetch() call and only 8 data-entry lines — appears to be a hollow handler chain
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 15 error(s); first: 60: ':' expected.
    - evidence: src/server.ts

### `julian-calendar` (confidence 1.00)
- 1 FATAL finding(s): pollution:python-ternary
  - **fatal** `pollution:python-ternary`: Python-style ternary in src/server.ts:54
    - evidence: src/server.ts:54  
    `const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS" if slug == "islamic-calendar" else "MONTH_NAMES" if slug == "julian-calendar" else "HAAB_MONTHS"}`
  - **medium** `content:external-fetch-or-data`: server.ts has no fetch() call and only 9 data-entry lines — appears to be a hollow handler chain
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 15 error(s); first: 54: ':' expected.
    - evidence: src/server.ts

### `lens-org` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 86: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `livestock` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 66: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `market-cap` (confidence 0.90)
- 2 HIGH findings: sdk:pricing-default-cost, executable:tsc-compile
  - **high** `sdk:pricing-default-cost`: pricing.defaultCostCents not found in settlegrid.init
    - evidence: src/server.ts
  - **high** `executable:tsc-compile`: tsc failed with 7 error(s); first: 36: Argument of type '{ toolSlug: string; }' is not assignable to parameter of type 'SettleGridInitConfig'.
  Property 'pricing' is missing in type '{ toolSlug: string; }' but required in type 'SettleGrid
    - evidence: src/server.ts

### `market-sentinel` (confidence 0.90)
- 3 HIGH findings: structural:required-files, structural:required-files, structural:required-files
  - **high** `structural:required-files`: missing required file: README.md
    - evidence: README.md
  - **high** `structural:required-files`: missing required file: Dockerfile
    - evidence: Dockerfile
  - **high** `structural:required-files`: missing required file: LICENSE
    - evidence: LICENSE

… and 38 more. See JSON report for full list.

## REVIEW candidates (sample)

- **`algorand`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`aml-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`case-law`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`cdc-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`cfr`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`climate-change`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`congress-bills`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`courtlistener`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`cron-scheduler`** (confidence 0.70): single HIGH finding: sdk:pricing-default-cost
- **`dow-jones`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`drugs-fda`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`edamam`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`eu-legislation`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`eu-sanctions`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`federal-register`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`ftse100`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`gdpr-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`hud-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`image-placeholder`** (confidence 0.70): single HIGH finding: sdk:pricing-default-cost
- **`ip-range`** (confidence 0.70): single HIGH finding: sdk:pricing-default-cost
- **`japan-estat`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`json-tools`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`jwt-decoder`** (confidence 0.70): single HIGH finding: sdk:pricing-default-cost
- **`link-preview`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`meteorite-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`mime-types`** (confidence 0.70): single HIGH finding: sdk:pricing-default-cost
- **`name-generator`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`nasa-apod`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`nasdaq100`** (confidence 0.70): single HIGH finding: executable:tsc-compile
- **`ocean-data`** (confidence 0.70): single HIGH finding: executable:tsc-compile
… and 22 more.
