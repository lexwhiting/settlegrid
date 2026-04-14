# Polar Merchant Onboarding Status

**Tracking ref:** P1.RAIL1
**Blocks:** P3.RAIL1, P3.RAIL2, P3.RAIL3 (Phase 3 Polar settlement rail)
**Created:** 2026-04-14

---

## Submission Details

| Field | Value |
|-------|-------|
| Business name | SettleGrid, Inc. |
| Country of incorporation | _TBD — fill in at submission_ |
| Business description | Payment infrastructure for AI tool monetization |
| Expected GMV range | _TBD — select at submission_ |
| Application submitted | **Not yet submitted** |
| Expected approval window | 2–3 weeks from submission |
| Expected approval by | _fill in: submission_date + 21 days_ |

---

## Status Checklist

- [ ] Polar organization created at https://polar.sh/dashboard
- [ ] Business survey completed
- [ ] Stripe Identity KYC completed (passport/ID + selfie)
- [ ] Application submitted for review
- [ ] Weekly status check scheduled (calendar reminder)
- [ ] **APPROVED** — update this doc with org ID + credentials stored in `.env`

---

## Weekly Status Log

Update this table every Monday until approval.

| Date | Status | Notes | Blocker? |
|------|--------|-------|----------|
| _YYYY-MM-DD_ | _pending / in review / approved / rejected_ | _any updates from Polar team_ | _yes/no + explanation_ |

---

## Escalation Contacts

| Channel | Contact | When to use |
|---------|---------|-------------|
| Polar support email | support@polar.sh | General questions, document issues |
| Polar Discord | https://discord.gg/polar (verify URL) | Faster turnaround for technical questions |
| Polar docs | https://polar.sh/docs/merchant-of-record/account-reviews | Self-service review status info |

**Escalation trigger:** if review exceeds 21 days with no update, send a polite status check to support@polar.sh referencing the application date and asking for ETA.

---

## Post-Approval Action Items

Once Polar approves the merchant account:

1. [ ] Copy org ID, API key, webhook secret into the production `.env` (NOT `.env.example`)
2. [ ] Verify `POLAR_API_KEY`, `POLAR_ORG_ID`, `POLAR_WEBHOOK_SECRET` present in:
       - Production Vercel env
       - Staging Vercel env (if separate)
       - Local `apps/web/.env.local` for dev
3. [ ] Unblock P3.RAIL1 / P3.RAIL2 / P3.RAIL3 for Phase 3 engineering
4. [ ] Update this doc: mark `APPROVED` in status checklist, record approval date
5. [ ] Archive this status tracker to `docs/legal/archive/` once Phase 3 ships

---

## Reference Links

- **Polar merchant signup:** https://polar.sh/dashboard
- **Polar MoR docs:** https://polar.sh/docs/merchant-of-record/introduction
- **Polar account reviews:** https://polar.sh/docs/merchant-of-record/account-reviews
- **Polar supported countries:** https://polar.sh/docs/merchant-of-record/supported-countries
- **Multi-rail architecture context:** `docs/multi-rail-architecture.md` (Pattern C)
