/**
 * Protocols visibly listed on the homepage.
 *
 * Aligned with the P1.MKT1 honest framing (see agents/beacon/prompts.ts
 * and docs/audits/15-protocol-claim.md). The 9 brokered protocols appear
 * first, followed by the 2 detection-adapter-only protocols. Emerging
 * rails (ACTP, EMVCo agent payments, DRAIN) are intentionally omitted
 * from the homepage list because the Smart Proxy does not broker them
 * yet — they are tracked by the Protocol agent but not surfaced as
 * "protocols SettleGrid supports today."
 *
 * Names match the canonical list in `@settlegrid/mcp` SETTLEGRID_ICP.protocols
 * (agents/shared/config.ts) so the homepage, Beacon prompt, and Protocol
 * agent prompt all agree.
 */
const protocols = [
  // 9 brokered by the Smart Proxy
  "MCP",
  "x402",
  "Stripe MPP",
  "AP2",
  "ACP",
  "UCP",
  "Visa TAP",
  "Mastercard Verifiable Intent",
  "Circle Nanopayments",
  // 2 detection-adapter-only
  "L402",
  "KYAPay",
]

export function Protocols() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Multi-Protocol Settlement
          </p>
          <p className="text-xl text-foreground max-w-xl">
            One SDK. The agent payment protocols developers actually need.
          </p>
        </div>

        {/* Protocols grid */}
        <div className="flex flex-wrap gap-3 mb-16">
          {protocols.map((protocol) => (
            <span
              key={protocol}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-full transition-colors duration-200 hover:border-muted-foreground/50 hover:text-foreground"
            >
              {protocol}
            </span>
          ))}
        </div>

        {/* Footer text */}
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
          From Stripe fiat rails to Bitcoin Lightning to stablecoin settlement —
          one integration.
        </p>
      </div>
    </section>
  )
}
