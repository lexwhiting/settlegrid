import Link from "next/link"
import { TextGenerateEffect } from "@/components/ui/text-generate-effect"
import { CopyButton } from "@/components/ui/copy-button"

const heroCode = `import { SettleGrid } from '@settlegrid/mcp'

const sg = new SettleGrid({ apiKey: 'sg_...' })
const tool = sg.wrap(myFunction, { costCents: 5 })`

export function Hero() {
  return (
    <section className="min-h-screen flex items-center relative overflow-hidden">
      {/* Hero background illustration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/brand/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.35,
          maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
        }}
      />

      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 pt-14">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left side - Copy */}
          <div className="flex flex-col gap-8 relative z-10">
            <div className="flex flex-col gap-5">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-foreground text-balance leading-[1.1]">
                <TextGenerateEffect words="The Settlement Layer for the" />{" "}
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
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
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
            {/* npm + GitHub links */}
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <a
                href="https://www.npmjs.com/package/@settlegrid/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0H1.763zM5.13 5.323h13.74v13.04H15.3V8.893h-3.57v9.47H5.13V5.323z"/></svg>
                @settlegrid/mcp
              </a>
              <a
                href="https://github.com/lexwhiting/settlegrid"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" clipRule="evenodd"/></svg>
                GitHub
              </a>
            </div>
          </div>

          {/* Right side - Code snippet */}
          <div className="w-full relative z-10">
            <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_40px_-12px_rgba(229,163,54,0.15)]">
              {/* Terminal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-2">
                    terminal
                  </span>
                </div>
                <CopyButton text={heroCode} />
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
