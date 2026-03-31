import Link from 'next/link'

export function Hero() {
  return (
    <section className="min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left side - Copy */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-foreground text-balance leading-[1.1]">
                The Settlement Layer for the{" "}
                <span className="text-[#E5A336]">AI Economy</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Per-call billing, usage metering, and automated payouts for any
                AI service. 15 protocols. Free forever.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="/start"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-colors"
              >
                Get started
              </Link>
              <Link
                href="/docs"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View docs <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* Right side - Code snippet */}
          <div className="w-full">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs text-muted-foreground font-mono ml-2">
                  terminal
                </span>
              </div>

              {/* Terminal content */}
              <div className="p-5 font-mono text-sm leading-relaxed">
                {/* npm install line */}
                <div className="flex items-center gap-2 text-muted-foreground mb-6">
                  <span className="text-[#28c840]">$</span>
                  <span>npm install</span>
                  <span className="text-foreground">@settlegrid/mcp</span>
                </div>

                {/* Code block */}
                <div className="space-y-1">
                  <div>
                    <span className="text-[#c678dd]">import</span>
                    <span className="text-foreground"> {"{"} </span>
                    <span className="text-[#e5c07b]">SettleGrid</span>
                    <span className="text-foreground"> {"}"} </span>
                    <span className="text-[#c678dd]">from</span>
                    <span className="text-[#98c379]">
                      {" "}
                      {`'@settlegrid/mcp'`}
                    </span>
                  </div>
                  <div className="h-3" />
                  <div>
                    <span className="text-[#c678dd]">const</span>
                    <span className="text-[#e06c75]"> sg</span>
                    <span className="text-foreground"> = </span>
                    <span className="text-[#c678dd]">new</span>
                    <span className="text-[#e5c07b]"> SettleGrid</span>
                    <span className="text-foreground">{"({ "}</span>
                    <span className="text-[#e06c75]">apiKey</span>
                    <span className="text-foreground">: </span>
                    <span className="text-[#98c379]">{`'sg_...'`}</span>
                    <span className="text-foreground">{" })"}</span>
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
        </div>
      </div>
    </section>
  )
}
