/**
 * AP2 Protocol Types (per Google Agentic Payments Protocol spec)
 *
 * SettleGrid acts as a Credentials Provider in the AP2 ecosystem,
 * issuing Verifiable Digital Credentials (VDCs) so AP2-compatible
 * agents can pay for MCP tool invocations.
 */

// ---- AP2 Agent Card (discovery) -----------------------------------------------

export interface AP2AgentCard {
  name: string
  description: string
  url: string
  skills: string[]
  extensions: string[]
  ap2_roles: ('credentials-provider' | 'merchant' | 'agent')[]
}

// ---- AP2 Mandates -------------------------------------------------------------

export interface IntentMandate {
  type: 'ap2.mandates.IntentMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string // ISO 8601
  expiresAt: string
  shoppingIntent: {
    category: string
    maxBudgetCents: number
    currency: string
    description: string
  }
  userSignature: string // ES256K JWT
  agentId: string
  nonce: string
}

export interface CartMandate {
  type: 'ap2.mandates.CartMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string
  expiresAt: string
  merchantId: string
  merchantSignature: string // ES256K JWT
  lineItems: Array<{
    id: string
    description: string
    amountCents: number
    currency: string
    quantity: number
  }>
  totalAmountCents: number
  currency: string
  intentMandateRef: string // reference to originating IntentMandate
}

export interface PaymentMandate {
  type: 'ap2.mandates.PaymentMandate'
  version: '0.1'
  mandateId: string
  issuedAt: string
  cartMandateRef: string
  paymentMethod: 'settlegrid_balance' | 'stripe_card' | 'usdc'
  paymentCredentialRef: string
  amountCents: number
  currency: string
  agentPresence: {
    agentId: string
    transactionModality: 'autonomous' | 'supervised' | 'manual'
    userVerificationMethod: 'passkey' | 'pin' | 'biometric' | 'none'
  }
  credentialsProviderSignature: string
}

// ---- Payment Credentials ------------------------------------------------------

export interface PaymentCredential {
  id: string
  type: 'settlegrid_balance' | 'stripe_card' | 'usdc'
  consumerId: string
  displayName: string
  lastFour?: string
  balanceCents?: number
  expiresAt: string
  tokenRef: string // opaque token for the credential
}

// ---- AP2 Skill Protocol -------------------------------------------------------

export interface AP2SkillRequest {
  skill: string
  params: Record<string, unknown>
  mandateRef?: string
}

export interface AP2SkillResponse {
  success: boolean
  data?: unknown
  error?: string
}

// ---- Verifiable Digital Credential (VDC) JWT Claims ---------------------------

export interface VDCClaims {
  iss: string // issuer (SettleGrid)
  sub: string // subject (consumer ID)
  aud: string // audience (merchant or agent)
  iat: number // issued at (epoch seconds)
  exp: number // expires at
  mandate_type: string
  mandate_id: string
  payment_method: string
  amount_cents: number
  currency: string
}
