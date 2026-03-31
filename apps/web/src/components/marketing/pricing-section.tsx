import { Check } from "lucide-react"
import Link from "next/link"

const freeTier = [
  "50,000 ops/month",
  "Unlimited tools",
  "7-day log retention",
  "1 webhook endpoint",
  "Basic dashboard",
]

const builderTier = [
  "200,000 ops/month",
  "30-day log retention",
  "3 webhook endpoints",
  "Sandbox mode",
  "Slack & Discord alerts",
  "Tool health monitoring",
  "Category benchmarking",
  "Revenue forecasting",
  "Priority marketplace listing",
]

const scaleTier = [
  "2,000,000 ops/month",
  "90-day log retention",
  "Team access (5 seats)",
  "Advanced analytics",
  "Consumer insights & churn detection",
  "Anomaly detection alerts",
  "Fraud detection (12 signals)",
  "Data export & audit logs",
  "IP allowlisting",
  "Enhanced weekly reports",
  "10 webhook endpoints",
]

export function PricingSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Pricing
          </p>
          <p className="text-lg text-foreground max-w-xl">
            Progressive take rate. Most developers never pay.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {/* Free tier */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col">
            <div className="flex flex-col gap-1 mb-6">
              <h3 className="text-xl font-medium text-foreground">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {freeTier.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <Check className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/start"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Builder tier */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col">
            <div className="flex flex-col gap-1 mb-6">
              <h3 className="text-xl font-medium text-foreground">Builder</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-foreground">$19</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {builderTier.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <Check className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/start"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Scale tier */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col">
            <div className="flex flex-col gap-1 mb-6">
              <h3 className="text-xl font-medium text-foreground">Scale</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-foreground">$79</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {scaleTier.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <Check className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/start"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
          All plans include the same progressive take rate: 0% on first $1K/mo,
          2% to $10K, 2.5% to $50K, 5% above.
        </p>
      </div>
    </section>
  )
}
