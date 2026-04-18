# Manual Wise Stopgap SOP

> **Note:** This filename matches the P2.INTL1 spec literal (`docs/decisions/manual-wise-stopgap-sop.md`). The canonical document — editable, versioned, and picked up by Phase-2 gate check 20 — lives at **[`../sops/manual-wise-payouts.md`](../sops/manual-wise-payouts.md)**. Follow that link; the two files are kept in sync, with the `sops/` path as the source of truth.

The gate-aligned path was chosen because:

- `docs/sops/` is where operational procedures already live in this repo (`docs/sops/` vs `docs/decisions/` — decisions are one-time architectural choices; this SOP is a recurring operational runbook)
- It's what `scripts/phase-gates/phase-2.ts` check 20 reads (`docs/sops/manual-wise-payouts.md`)
- The shorter filename drops the `-stopgap-sop` suffix that was redundant (the whole file is the SOP for the stopgap)

If you edit this file, edit `../sops/manual-wise-payouts.md` instead — changes here will drift. This stub exists only so a reader following the spec-literal path arrives at the right place.
