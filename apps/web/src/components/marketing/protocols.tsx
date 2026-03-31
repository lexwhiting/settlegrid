const protocols = [
  "MCP",
  "MPP",
  "x402",
  "AP2",
  "Visa TAP",
  "UCP",
  "ACP",
  "Mastercard Agent Pay",
  "Circle Nano",
  "REST",
  "L402",
  "Alipay Trust",
  "KYAPay",
  "EMVCo",
  "DRAIN",
]

export function Protocols() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            15 Protocols
          </p>
          <p className="text-lg text-foreground max-w-xl">
            One SDK. Every payment protocol an AI agent will ever need.
          </p>
        </div>

        {/* Protocols grid */}
        <div className="flex flex-wrap gap-3 mb-16">
          {protocols.map((protocol) => (
            <span
              key={protocol}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-full"
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
