/**
 * Project metadata source of truth for the P3.7 directory-submission
 * packet builder.
 *
 * This is a small, typed, hand-maintained snapshot of the public-facing
 * SettleGrid facts — sourced from `apps/web/src/app/layout.tsx`, the
 * SDK's `packages/mcp/package.json`, and `apps/web/public/llms.txt`.
 *
 * It is a snapshot on purpose: directory-submission packets must be
 * deterministic so `build.ts` output is stable across runs, and must
 * not transitively depend on the web app's build graph (the packet
 * builder runs from `scripts/` standalone). If any of the source
 * files change meaningfully (tagline rewrites, URL migrations,
 * renamed GitHub org), update this file and re-run the builder.
 */

export interface ProjectMetadata {
  name: string
  tagline: string
  /** <=80 chars. Used for tight slots (nav bullet, X/Bluesky post). */
  descriptionShort: string
  /** <=160 chars. Used for awesome-list bullets + form short-desc fields. */
  descriptionMedium: string
  /** <=500 chars. Used for long-form descriptions (Smithery card, Glama form). */
  descriptionLong: string
  /** Ordered by specificity — most directories show the first 5-8. */
  tags: string[]
  urls: {
    homepage: string
    github: string
    npmPackage: string
    docs: string
    /** Live demo URL — null if none is published yet. */
    demo: string | null
  }
  logo: {
    /** Repo-relative path. Present on disk at commit time. */
    path: string
    format: 'svg' | 'png' | 'jpg'
    description: string
  }[]
  /** Repo-relative paths to 1280×800-ish screenshots used by gallery-style directories. */
  screenshots: string[]
  author: {
    name: string
    githubHandle: string
    email: string
  }
}

export const projectMetadata: ProjectMetadata = {
  name: 'SettleGrid',
  tagline: 'The Settlement Layer for the AI Economy',
  descriptionShort:
    'Per-call billing for MCP tools. 2 lines of code, free up to 50K ops/mo.',
  descriptionMedium:
    'Settlement layer for AI tools. Per-call billing, Stripe payouts, and multi-protocol payments for MCP tools, APIs, and agents.',
  descriptionLong:
    'SettleGrid is the settlement layer for the AI economy. Monetize MCP tools, REST APIs, and AI agents with per-call billing, automated Stripe payouts, and a unified gateway across 9+ agent payment protocols (MCP, x402, Stripe MPP, AP2, ACP, UCP, TAP, Verifiable Intent, Circle Nanopayments). Install `@settlegrid/mcp`, wrap your handler with `sg.wrap()` — every call is metered, billed, and settled. Free forever for most devs: 50K ops/mo, progressive take rate from 0%.',
  tags: [
    'mcp',
    'settlement',
    'billing',
    'monetization',
    'payments',
    'stripe',
    'ai-agents',
    'per-call-billing',
    'x402',
    'api-gateway',
  ],
  urls: {
    homepage: 'https://settlegrid.ai',
    github: 'https://github.com/lexwhiting/settlegrid',
    npmPackage: 'https://www.npmjs.com/package/@settlegrid/mcp',
    docs: 'https://settlegrid.ai/docs',
    demo: null,
  },
  logo: [
    {
      path: 'apps/web/public/logos/icon-color.svg',
      format: 'svg',
      description: 'Square icon mark (color, theme-agnostic background)',
    },
    {
      path: 'apps/web/public/logos/logo-color-light.svg',
      format: 'svg',
      description: 'Horizontal wordmark for light backgrounds',
    },
    {
      path: 'apps/web/public/logos/logo-color-dark.svg',
      format: 'svg',
      description: 'Horizontal wordmark for dark backgrounds',
    },
    {
      path: 'apps/web/public/favicon-32.png',
      format: 'png',
      description: '32×32 favicon (fallback PNG — directories needing 400×400 PNG require a conversion step noted in the packet)',
    },
  ],
  screenshots: [
    'apps/web/public/screenshots/Dashboard 1.jpg',
    'apps/web/public/screenshots/Dashboard 2.jpg',
    'apps/web/public/screenshots/Analytics 1.jpg',
    'apps/web/public/screenshots/Discovery 1.jpg',
    'apps/web/public/screenshots/Home Page Protocol.jpg',
  ],
  author: {
    name: 'Lex Whiting',
    githubHandle: 'lexwhiting',
    email: 'lex@settlegrid.ai',
  },
}
