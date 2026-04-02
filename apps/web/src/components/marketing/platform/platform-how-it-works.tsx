'use client'

import { StaggerContainer } from '@/components/ui/stagger-container'
import { CopyButton } from '@/components/ui/copy-button'

const wrapCode = `import { SettleGrid } from '@settlegrid/mcp'

const sg = new SettleGrid({ apiKey: 'sg_...' })
const tool = sg.wrap(myFunction, { costCents: 5 })`

export function PlatformHowItWorks() {
  return (
    <section className="py-16 lg:py-24">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            From function to revenue in 4 steps
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Step 1 - Wrap (wide) */}
          <div className="md:col-span-2">
            <StaggerContainer>
              <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
                <span className="text-sm font-mono text-[#E5A336]">01</span>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex flex-col gap-3 lg:max-w-md">
                    <h3 className="text-xl font-medium text-foreground">Wrap</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      2 lines of code. Import the SDK, wrap your function with a
                      price. That&apos;s the entire integration.
                    </p>
                  </div>
                  <div className="lg:flex-1 lg:max-w-lg">
                    <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_-12px_rgba(229,163,54,0.15)]">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono ml-2">
                            index.ts
                          </span>
                        </div>
                        <CopyButton text={wrapCode} />
                      </div>
                      <div className="p-5 font-mono text-xs leading-relaxed">
                        <div className="space-y-1">
                          <div>
                            <span className="text-[#c678dd]">import</span>
                            <span className="text-foreground">{' { '}</span>
                            <span className="text-[#e5c07b]">SettleGrid</span>
                            <span className="text-foreground">{' } '}</span>
                            <span className="text-[#c678dd]">from</span>
                            <span className="text-[#98c379]">{" '@settlegrid/mcp'"}</span>
                          </div>
                          <div className="h-3" />
                          <div>
                            <span className="text-[#c678dd]">const</span>
                            <span className="text-[#e06c75]"> sg</span>
                            <span className="text-foreground"> = </span>
                            <span className="text-[#c678dd]">new</span>
                            <span className="text-[#e5c07b]"> SettleGrid</span>
                            <span className="text-foreground">{'({ '}</span>
                            <span className="text-[#e06c75]">apiKey</span>
                            <span className="text-foreground">: </span>
                            <span className="text-[#98c379]">{"'sg_...'"}</span>
                            <span className="text-foreground">{' })'}</span>
                          </div>
                          <div>
                            <span className="text-[#c678dd]">const</span>
                            <span className="text-[#e06c75]"> tool</span>
                            <span className="text-foreground"> = </span>
                            <span className="text-[#e06c75]">sg</span>
                            <span className="text-foreground">.</span>
                            <span className="text-[#61afef]">wrap</span>
                            <span className="text-foreground">(</span>
                            <span className="text-[#e06c75]">myFunction</span>
                            <span className="text-foreground">{', { '}</span>
                            <span className="text-[#e06c75]">costCents</span>
                            <span className="text-foreground">: </span>
                            <span className="text-[#d19a66]">5</span>
                            <span className="text-foreground">{' })'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerContainer>
          </div>

          {/* Step 2 - Price */}
          <StaggerContainer staggerDelay={0.15}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">02</span>
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-medium text-foreground">Price</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Set per-call pricing in the dashboard. Flat rate, tiered, or
                  free — change anytime.
                </p>
              </div>
            </div>
          </StaggerContainer>

          {/* Step 3 - Deploy */}
          <StaggerContainer staggerDelay={0.15}>
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">03</span>
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-medium text-foreground">Deploy</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Push to Vercel, Railway, or any host. Your tool is live and
                  discoverable immediately.
                </p>
              </div>
            </div>
          </StaggerContainer>

          {/* Step 4 - Earn (wide) */}
          <div className="md:col-span-2">
            <StaggerContainer staggerDelay={0.2}>
              <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
                <span className="text-sm font-mono text-[#E5A336]">04</span>
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-medium text-foreground">Earn</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Revenue flows to your Stripe account automatically. 95-100%
                    revenue share. No invoicing, no chasing payments.
                  </p>
                </div>
              </div>
            </StaggerContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
