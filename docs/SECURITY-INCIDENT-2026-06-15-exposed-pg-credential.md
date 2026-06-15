# SECURITY INCIDENT — exposed production Postgres credential (2026-06-15)

> Separate from the V-N2 work. Surfaced by an unsolicited "GitHub secret scanner" email ("Robin"); the email's
> cited commit hash was bogus/non-local, but the underlying exposure is **REAL — verified locally**. Do NOT
> click the email's links or reply to the sender; this record stands on independent local verification.

## What was exposed (VERIFIED)
A hardcoded **production Supabase Postgres superuser connection string** in
`scripts/backfill-mcp-registry-urls.mjs` (was line 14-15): user `postgres`, host
`db.ncqjvmpruutwhilldcjp.supabase.co:5432/postgres`, password present (redacted). Committed in `23663006`
(the "(K) HMAC-pepper" commit) and present on the `origin` remote `https://github.com/lexwhiting/settlegrid.git`.
Exposed since ~2026-03-31. Scan confirmed this is the ONLY hardcoded DB connection string in the tree; the leaked
password appears in just this one file. (Two `eyJ…` strings in `learn/protocols/[slug]/page.tsx` and
`DemoRequestBuilder.tsx` are base64 x402/JWT **demo payloads**, not prod secrets — low, worth a human glance.)

## What was done (reversible, in the working tree)
- Replaced the hardcoded string with `process.env.DATABASE_URL` (the app's canonical var) + a fail-fast guard
  in `scripts/backfill-mcp-registry-urls.mjs`. Verified: 0 occurrences of the secret in the working tree,
  `node --check` passes, `CONNECTION_STRING` usage intact. This is an UNCOMMITTED change in `scripts/`, separate
  from the V-N2 settlement work — commit it on its own (with the rotation below), NOT in the V-N2 founder-close.

## ⚠ FOUNDER ACTIONS — REQUIRED (only the founder can do these)
1. **ROTATE NOW.** Removing the secret from code does NOT un-leak it — it is live and was public for ~2.5 months.
   Supabase → project `ncqjvmpruutwhilldcjp` → Database → **reset database password**; then update `DATABASE_URL`
   in every environment (Vercel per-env + local `.env`).
2. **After rotating:** purge the secret from git history (`git filter-repo`/BFG over commit `23663006` et al.) and
   force-push. This is DESTRUCTIVE + outward-facing + the worktree is shared (~15 sessions) with uncommitted
   founder-gated work — sequence: **rotate → commit the env-var fix → purge history → force-push**. NOT done
   autonomously (needs explicit founder go-ahead).
3. Verify the repo's visibility (make private if it shouldn't be public — rotation is required either way), and
   check Supabase access/usage logs for unauthorized access during the exposure window.
4. For thoroughness beyond this working-tree + targeted scan, run a dedicated full-history secret scanner
   (`gitleaks detect` / `trufflehog git`) — a grep is not a complete history audit.

## Status
Working tree: remediated (secret removed). Git history + remote + the live credential: **STILL EXPOSED until the
founder rotates + purges.** This is the operative risk.
