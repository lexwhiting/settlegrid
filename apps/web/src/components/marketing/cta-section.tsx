import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
            Start earning from your AI tools
          </h2>
          <p className="text-lg text-muted-foreground">
            Free forever. Set up in 90 seconds.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Link
              href="/start"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
            >
              Get started
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              View docs
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
