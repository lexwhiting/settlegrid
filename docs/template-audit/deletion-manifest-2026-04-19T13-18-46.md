# Template Corpus Cull — Deletion Manifest

**Source audit run:** run-2026-04-19T17-12-16-397Z
**Policy applied:** strict
  - All REMOVE verdicts (fatal | 2+ high | 1 high + 2+ medium) deleted.
  - All REVIEW verdicts (1 high | 3+ medium) deleted under strict mandate.
  - CANONICAL_20 (P2.8-polished, carries template.json) preserved.

**Totals:** 140 templates deleted (13.7% of 1,022 corpus)
  - 88 REMOVE (fatal / multi-high failures)
  - 52 REVIEW (single-high failures — strict promotion)

**Driving failure modes:**
  - 132 templates failed TSC compile (broken TS)
  - 86 templates missing `pricing.defaultCostCents` (un-meterable)
  - 4 templates carried Python-ternary leakage (calendar family)
  - 15 templates missing required files
  - 70 templates lacked external-fetch AND reference-data (hollow handlers)

## Deleted templates

### REMOVE (88)

| Slug | Confidence | Findings summary |
|---|---|---|
| `adafruit-io` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `adsb-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `ais-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `altmetric` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `arduino-cloud` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `banking-rates` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `bioarxiv` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `biofuel` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `bond-yields` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `cds-spreads` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `cell-tower` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `code-reviewer` | 0.90 | structural:required-files:high|structural:required-files:high|structural:required-files:high|sdk:tool-slug-matches-dir:medium |
| `commodity-futures` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `commodity-prices` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `core-api` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `credit-card` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `crop-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `crowdfunding` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `data-enrichment` | 0.90 | structural:required-files:high|structural:required-files:high|structural:required-files:high |
| `datacite` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `dimensions` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `dividend-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `doaj` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `earnings-calendar` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `economic-calendar` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `encoding` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `etf-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `europe-pmc` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `farm-subsidies` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `fatcat` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `fisheries` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `food-prices` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `futures-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `gdp-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `google-scholar` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `ham-radio` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `hebrew-calendar` | 1.00 | pollution:python-ternary:fatal|content:external-fetch-or-data:medium|executable:tsc-compile:high |
| `image-classifier` | 0.90 | structural:required-files:high|structural:required-files:high|structural:required-files:high|executable:tsc-compile:high |
| `inflation` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `insider-trading` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `institutional` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `insurance-rates` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `ipo-calendar` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `irrigation` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `islamic-calendar` | 1.00 | pollution:python-ternary:fatal|content:external-fetch-or-data:medium|executable:tsc-compile:high |
| `julian-calendar` | 1.00 | pollution:python-ternary:fatal|content:external-fetch-or-data:medium|executable:tsc-compile:high |
| `lens-org` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `livestock` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `market-cap` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `market-sentinel` | 0.90 | structural:required-files:high|structural:required-files:high|structural:required-files:high |
| `math-genealogy` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `mayan-calendar` | 1.00 | pollution:python-ternary:fatal|executable:tsc-compile:high |
| `medrxiv` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `mutual-fund` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `openapc` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `openiot` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `options-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `orcid` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `organic` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `particle` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `pe-ratios` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `pesticide` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `purpleair` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `radio-browser` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `reit-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `repec` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `retraction-watch` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `ror` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `sector-performance` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `sensor-community` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `sherpa-romeo` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `short-interest` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `smart-citizen` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `soil-survey` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `ssrn` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `stock-screener` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `tax-rates` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `thingspeak` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `timber` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `translation` | 0.90 | structural:required-files:high|structural:required-files:high|structural:required-files:high|sdk:tool-slug-matches-dir:medium |
| `unemployment` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `unpaywall` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `usda-ers` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `usda-nass` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `venture-capital` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `vix` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `weather-crop` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |
| `wifi-data` | 0.90 | sdk:pricing-default-cost:high|executable:tsc-compile:high |

### REVIEW → REMOVE (52, strict-promoted)

| Slug | Confidence | Findings summary |
|---|---|---|
| `algorand` | 0.70 | executable:tsc-compile:high |
| `aml-data` | 0.70 | executable:tsc-compile:high |
| `case-law` | 0.70 | executable:tsc-compile:high |
| `cdc-data` | 0.70 | executable:tsc-compile:high |
| `cfr` | 0.70 | executable:tsc-compile:high |
| `climate-change` | 0.70 | executable:tsc-compile:high |
| `congress-bills` | 0.70 | executable:tsc-compile:high |
| `courtlistener` | 0.70 | executable:tsc-compile:high |
| `cron-scheduler` | 0.70 | sdk:pricing-default-cost:high |
| `dow-jones` | 0.70 | executable:tsc-compile:high |
| `drugs-fda` | 0.70 | executable:tsc-compile:high |
| `edamam` | 0.70 | executable:tsc-compile:high |
| `eu-legislation` | 0.70 | executable:tsc-compile:high |
| `eu-sanctions` | 0.70 | executable:tsc-compile:high |
| `federal-register` | 0.70 | executable:tsc-compile:high |
| `ftse100` | 0.70 | executable:tsc-compile:high |
| `gdpr-data` | 0.70 | executable:tsc-compile:high |
| `hud-data` | 0.70 | executable:tsc-compile:high |
| `image-placeholder` | 0.70 | sdk:pricing-default-cost:high|content:input-validation-throws:low |
| `ip-range` | 0.70 | sdk:pricing-default-cost:high |
| `japan-estat` | 0.70 | executable:tsc-compile:high |
| `json-tools` | 0.70 | executable:tsc-compile:high |
| `jwt-decoder` | 0.70 | sdk:pricing-default-cost:high |
| `link-preview` | 0.70 | executable:tsc-compile:high |
| `meteorite-data` | 0.70 | content:readme-substance:low|executable:tsc-compile:high |
| `mime-types` | 0.70 | sdk:pricing-default-cost:high |
| `name-generator` | 0.70 | content:external-fetch-or-data:medium|content:input-validation-throws:low|executable:tsc-compile:high |
| `nasa-apod` | 0.70 | executable:tsc-compile:high |
| `nasdaq100` | 0.70 | executable:tsc-compile:high |
| `ocean-data` | 0.70 | executable:tsc-compile:high |
| `ofac` | 0.70 | executable:tsc-compile:high |
| `pep-data` | 0.70 | executable:tsc-compile:high |
| `product-hunt` | 0.70 | executable:tsc-compile:high |
| `property-tax` | 0.70 | executable:tsc-compile:high |
| `qr-code` | 0.70 | executable:tsc-compile:high |
| `regulations-gov` | 0.70 | executable:tsc-compile:high |
| `renewable-energy` | 0.70 | executable:tsc-compile:high |
| `rss-reader` | 0.70 | executable:tsc-compile:high |
| `russell2000` | 0.70 | executable:tsc-compile:high |
| `sanctions-lists` | 0.70 | executable:tsc-compile:high |
| `screenshot` | 0.70 | executable:tsc-compile:high |
| `semver` | 0.70 | sdk:pricing-default-cost:high |
| `short-url` | 0.70 | executable:tsc-compile:high |
| `sitemap-parser` | 0.70 | executable:tsc-compile:high |
| `sp500` | 0.70 | executable:tsc-compile:high |
| `uk-legislation` | 0.70 | executable:tsc-compile:high |
| `un-sanctions` | 0.70 | executable:tsc-compile:high |
| `url-tools` | 0.70 | content:external-fetch-or-data:medium|executable:tsc-compile:high |
| `usa-spending` | 0.70 | executable:tsc-compile:high |
| `usc` | 0.70 | executable:tsc-compile:high |
| `user-agent-parser` | 0.70 | sdk:pricing-default-cost:high |
| `usps-lookup` | 0.70 | executable:tsc-compile:high |
