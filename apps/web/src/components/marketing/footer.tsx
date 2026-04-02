import Link from "next/link"
import Image from "next/image"

const productLinks = [
  { label: "Get started", href: "/start" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Free Tools", href: "/free-tools" },
  { label: "Trending", href: "/marketplace/trending" },
  { label: "Templates", href: "/templates" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
]

const resourceLinks = [
  { label: "Learn", href: "/learn" },
  { label: "Glossary", href: "/learn/glossary" },
  { label: "FAQ", href: "/faq" },
  { label: "Ask", href: "/ask" },
  { label: "Activity", href: "/activity" },
  { label: "Academic Program", href: "/academic" },
  { label: "Status", href: "/status" },
]

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "mailto:support@settlegrid.ai" },
]

export function Footer() {
  return (
    <footer className="py-16 lg:py-20">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Footer columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16 mb-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
            <Image
              src="/brand/wordmark-transparent.svg"
              alt="SettleGrid"
              width={120}
              height={28}
              className="h-7 w-auto"
            />
            <p className="text-sm text-muted-foreground">
              The settlement layer for the AI economy.
            </p>
          </div>

          {/* Product column */}
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium text-foreground">Product</span>
            <ul className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources column */}
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium text-foreground">
              Resources
            </span>
            <ul className="flex flex-col gap-3">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium text-foreground">Company</span>
            <ul className="flex flex-col gap-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Alerterra, LLC
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/lexwhiting/settlegrid"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/settlegrid"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
