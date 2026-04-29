import { StaggerContainer } from '@/components/ui/stagger-container'

const brackets = [
  { range: '$0 - $1K', rate: '0%' },
  { range: '$1K - $10K', rate: '2%' },
  { range: '$10K - $50K', rate: '2.5%' },
  { range: '$50K+', rate: '5%' },
]

export function PlatformEconomics() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Economics
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            Keep 95-100% of your revenue
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mt-2">
            Traditional marketplaces take 15-30%. We think that&apos;s backwards.
          </p>
        </div>

        <StaggerContainer className="max-w-lg">
          {/* Take rate table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:border-muted-foreground/50">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-2 px-6 py-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Monthly Revenue
                </span>
                <span className="text-sm font-medium text-muted-foreground text-right">
                  SettleGrid Take
                </span>
              </div>
              {brackets.map((bracket) => (
                <div key={bracket.range} className="grid grid-cols-2 px-6 py-4">
                  <span className="text-sm text-foreground">{bracket.range}</span>
                  <span className="text-sm font-mono text-[#E5A336] text-right">
                    {bracket.rate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-sm text-muted-foreground mt-6">
            Free forever at 50,000 ops/month. Most developers never pay.
          </p>
        </StaggerContainer>
      </div>
    </section>
  )
}
