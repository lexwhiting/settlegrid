/**
 * Visa TAP (Trusted Agent Protocol) Types
 *
 * Type definitions for Visa's Trusted Agent Protocol integration.
 * Visa TAP enables AI agents to hold scoped Visa tokens with per-transaction
 * and daily spending limits, providing card-network-level settlement.
 *
 * NOTE: Visa TAP requires sandbox access and is restricted. This module
 * provides type definitions and stub implementations only.
 */

// ---- Visa Agent Token ---------------------------------------------------------

export interface VisaAgentToken {
  id: string
  agentId: string
  consumerId: string
  tokenRef: string // Visa token reference
  lastFour: string | null // last 4 digits of underlying card
  cardBrand: 'visa' | 'mastercard' | null
  expiresAt: string // ISO 8601
  status: 'active' | 'suspended' | 'revoked' | 'expired'
  merchantScope: string | null // null = unrestricted, or merchant ID
  maxTransactionCents: number | null // per-transaction limit
  dailyLimitCents: number | null
  dailySpentCents: number
  lastUsedAt: string | null // ISO 8601
  createdAt: string
  updatedAt: string
}

// ---- Visa Payment Instruction -------------------------------------------------

export interface VisaPaymentInstruction {
  tokenReferenceId: string
  amountCents: number
  currency: string
  merchantId: string
  agentAttestation: {
    agentId: string
    confidence: number // 0-1
    decisionContext: string
    userVerificationMethod: 'passkey' | 'pin' | 'biometric' | 'none'
  }
}

// ---- Visa TAP Configuration ---------------------------------------------------

export interface VisaTAPConfig {
  apiUrl: string
  apiKey: string | undefined
  sharedSecret: string | undefined
  enabled: boolean
}

// ---- Visa Token Provision Request/Response ------------------------------------

export interface VisaTokenProvisionRequest {
  primaryAccountNumber: string
  expirationDate: string // MM/YYYY
  cardholderName: string
  agentId: string
  merchantScope?: string
  maxTransactionCents?: number
}

export interface VisaTokenProvisionResponse {
  tokenReferenceId: string
  lastFourDigits: string
  tokenStatus: string
  expirationDate: string
}

// ---- Visa Payment Response ----------------------------------------------------

export interface VisaPaymentResponse {
  authorizationCode: string
  networkReferenceId: string
  responseCode: string
  responseMessage: string
}

// ---- Visa Transaction ---------------------------------------------------------

export interface VisaTransaction {
  id: string
  tokenId: string
  consumerId: string
  amountCents: number
  currency: string
  merchantId: string | null
  merchantName: string | null
  status: 'pending' | 'authorized' | 'captured' | 'declined' | 'reversed' | 'disputed'
  visaAuthCode: string | null
  visaNetworkRef: string | null
  agentAttestation: {
    agentId: string
    confidence: number
    decisionContext: string
    userVerification: string
  } | null
  disputeStatus: 'opened' | 'under_review' | 'resolved' | null
  createdAt: string
  updatedAt: string
}
