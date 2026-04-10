/**
 * Protocols visibly listed on the homepage.
 *
 * Only protocols with shipped adapter code in
 * apps/web/src/lib/settlement/adapters/ are listed here. Three protocols
 * previously displayed (REST, EMVCo, DRAIN) were removed in April 2026:
 * REST and EMVCo were miscategorized (not actually agent payment protocols);
 * DRAIN had a cryptographic implementation defect being addressed under the
 * Quantum Leap settlement-layer plan. Additional protocol detail and the
 * full canonical positioning will land via P1.MKT1.
 */
const protocols = [
  "MCP",
  "MPP",
  "x402",
  "AP2",
  "Visa TAP",
  "UCP",
  "ACP",
  "Mastercard Verifiable Intent",
  "Circle Nano",
  "L402",
  "Alipay Trust",
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
