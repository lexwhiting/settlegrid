import { StaggerContainer } from "@/components/ui/stagger-container"

export function Features() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-16">
          How it works
        </p>

        {/* Bento grid layout */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Step 1 - Wrap (spans 2 columns on desktop) */}
          <div className="md:col-span-2">
            <StaggerContainer>
              <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
                <span className="text-sm font-mono text-[#E5A336]">01</span>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex flex-col gap-3 lg:max-w-md">
                    <h3 className="text-xl font-medium text-foreground">Wrap</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Wrap any function in 2 lines of code.
                    </p>
                  </div>
                  <div className="lg:flex-1 lg:max-w-lg">
                    <div className="rounded-md bg-background border border-border p-4 font-mono text-xs leading-relaxed">
                      <div>
                        <span className="text-[#c678dd]">const</span>
                        <span className="text-[#e06c75]"> tool</span>
                        <span className="text-foreground"> = </span>
                        <span className="text-[#e06c75]">sg</span>
                        <span className="text-foreground">.</span>
                        <span className="text-[#61afef]">wrap</span>
                        <span className="text-foreground">(</span>
                        <span className="text-[#e06c75]">fn</span>
                        <span className="text-foreground">, {"{ "}</span>
                        <span className="text-[#e06c75]">costCents</span>
                        <span className="text-foreground">: </span>
                        <span className="text-[#d19a66]">5</span>
                        <span className="text-foreground">{" })"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerContainer>
          </div>

          {/* Steps 2 and 3 */}
          <StaggerContainer staggerDelay={0.15}>
            {/* Step 2 - Meter */}
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">02</span>
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-medium text-foreground">Meter</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every call is metered, billed, and budget-enforced in under
                  50ms.
                </p>
              </div>
            </div>
          </StaggerContainer>

          <StaggerContainer staggerDelay={0.15}>
            {/* Step 3 - Earn */}
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5 transition-all duration-200 hover:border-muted-foreground/50 hover:-translate-y-0.5">
              <span className="text-sm font-mono text-[#E5A336]">03</span>
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-medium text-foreground">Earn</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Revenue flows to your Stripe account automatically. 95–100%
                  revenue share.
                </p>
              </div>
            </div>
          </StaggerContainer>
        </div>
      </div>
    </section>
  )
}
