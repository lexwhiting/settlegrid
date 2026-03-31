export function Features() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground mb-16">
          How it works
        </p>

        {/* Steps grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Step 1 - Wrap */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5">
            <span className="text-sm font-mono text-[#E5A336]">01</span>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-medium text-foreground">Wrap</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Wrap any function in 2 lines of code.
              </p>
            </div>
            {/* Code snippet */}
            <div className="mt-auto pt-4">
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
                  <span className="text-foreground">)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 - Meter */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5">
            <span className="text-sm font-mono text-[#E5A336]">02</span>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-medium text-foreground">Meter</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every call is metered, billed, and budget-enforced in under
                50ms.
              </p>
            </div>
          </div>

          {/* Step 3 - Earn */}
          <div className="rounded-lg border border-border bg-card p-6 lg:p-8 flex flex-col gap-5">
            <span className="text-sm font-mono text-[#E5A336]">03</span>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-medium text-foreground">Earn</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Revenue flows to your Stripe account automatically. 95–100%
                revenue share.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
