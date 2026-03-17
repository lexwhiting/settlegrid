/**
 * Double-entry ledger for the settlement engine.
 *
 * All balance changes MUST go through postLedgerEntry().
 * Entries are immutable — corrections via compensating entries only.
 */

import { db } from '@/lib/db'
import { accounts, ledgerEntries } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { LedgerCategory } from './types'

export interface PostEntryParams {
  debitAccountId: string
  creditAccountId: string
  amountCents: number
  currencyCode?: string
  category: LedgerCategory
  operationId?: string
  batchId?: string
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Post a balanced double-entry to the ledger.
 *
 * Creates two entries (one debit, one credit) and updates both account balances
 * in a single database transaction with optimistic locking.
 *
 * @returns The IDs of the two ledger entries created
 * @throws Error if optimistic lock fails (concurrent modification)
 */
export async function postLedgerEntry(params: PostEntryParams): Promise<{
  debitEntryId: string
  creditEntryId: string
}> {
  const {
    debitAccountId,
    creditAccountId,
    amountCents,
    currencyCode = 'USD',
    category,
    operationId,
    batchId,
    description,
    metadata,
  } = params

  if (amountCents <= 0) {
    throw new Error(`Ledger entry amount must be positive, got ${amountCents}`)
  }

  if (debitAccountId === creditAccountId) {
    throw new Error('Debit and credit accounts must be different')
  }

  return await db.transaction(async (tx) => {
    // 1. Read both accounts with current versions
    const [debitAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, debitAccountId))
      .limit(1)

    const [creditAccount] = await tx
      .select({ id: accounts.id, version: accounts.version, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, creditAccountId))
      .limit(1)

    if (!debitAccount) throw new Error(`Debit account not found: ${debitAccountId}`)
    if (!creditAccount) throw new Error(`Credit account not found: ${creditAccountId}`)

    // 2. Create the two ledger entries
    const [debitEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: debitAccountId,
        entryType: 'debit',
        amountCents,
        currencyCode,
        operationId: operationId ?? null,
        batchId: batchId ?? null,
        category,
        counterpartyAccountId: creditAccountId,
        description,
        metadata: metadata ?? null,
      })
      .returning({ id: ledgerEntries.id })

    const [creditEntry] = await tx
      .insert(ledgerEntries)
      .values({
        accountId: creditAccountId,
        entryType: 'credit',
        amountCents,
        currencyCode,
        operationId: operationId ?? null,
        batchId: batchId ?? null,
        category,
        counterpartyAccountId: debitAccountId,
        description,
        metadata: metadata ?? null,
      })
      .returning({ id: ledgerEntries.id })

    // 3. Update account balances with optimistic locking
    const [updatedDebit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} - ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, debitAccountId), eq(accounts.version, debitAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedDebit) {
      throw new Error(`Optimistic lock failed on debit account ${debitAccountId} — concurrent modification`)
    }

    const [updatedCredit] = await tx
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${amountCents}`,
        version: sql`${accounts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, creditAccountId), eq(accounts.version, creditAccount.version)))
      .returning({ id: accounts.id })

    if (!updatedCredit) {
      throw new Error(`Optimistic lock failed on credit account ${creditAccountId} — concurrent modification`)
    }

    return {
      debitEntryId: debitEntry.id,
      creditEntryId: creditEntry.id,
    }
  })
}

/**
 * Post a ledger entry asynchronously (fire-and-forget).
 * Used for the hot path where we don't want to block on DB writes.
 */
export function postLedgerEntryAsync(params: PostEntryParams): void {
  postLedgerEntry(params).catch((err) => {
    logger.error('ledger.post_entry_failed', {
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      amountCents: params.amountCents,
      category: params.category,
    }, err)
  })
}

/**
 * Compute the balance for an account from ledger entries.
 * Used for reconciliation — compare with cached balanceCents.
 */
export async function computeBalanceFromLedger(accountId: string): Promise<number> {
  const result = await db
    .select({
      totalCredits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'credit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
      totalDebits: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerEntries.entryType} = 'debit' THEN ${ledgerEntries.amountCents} ELSE 0 END), 0)`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.accountId, accountId))

  const { totalCredits, totalDebits } = result[0]
  return Number(totalCredits) - Number(totalDebits)
}

/**
 * Reconcile an account's cached balance with the ledger.
 * Returns the discrepancy (positive = cache higher than ledger).
 */
export async function reconcileAccount(accountId: string): Promise<{
  cachedBalance: number
  ledgerBalance: number
  discrepancy: number
}> {
  const [account] = await db
    .select({ balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) throw new Error(`Account not found: ${accountId}`)

  const ledgerBalance = await computeBalanceFromLedger(accountId)

  return {
    cachedBalance: account.balanceCents,
    ledgerBalance,
    discrepancy: account.balanceCents - ledgerBalance,
  }
}
