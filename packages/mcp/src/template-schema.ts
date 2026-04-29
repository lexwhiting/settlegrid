/**
 * Template manifest schema — the shared source of truth for every
 * template in `open-source-servers/` and
 * `packages/create-settlegrid-tool/templates/`. The registry builder
 * (P2.7), gallery SSG (P2.9), CLI scaffolder, and quality-gate CI
 * (P2.13) all consume the same Zod schema + generated JSON Schema
 * so a single change here propagates to every downstream surface
 * without separate maintenance.
 *
 * Notes on the shape:
 *   - `slug` is URL-safe so templates can live at
 *     `settlegrid.ai/gallery/<slug>` directly.
 *   - `version` is semver major.minor.patch — same format the CLI
 *     uses for `@settlegrid/mcp` dependency pinning.
 *   - `pricing.perCallUsdCents` is a RUNTIME refinement away from
 *     being optional: if `pricing.model === 'per-call'`, the
 *     amount is required. See `.refine` below.
 *   - Media fields (`screenshots`, `loomUrl`, `deployButton`) are
 *     all optional so barebones templates still validate cleanly
 *     under the auto-generated stub path (P2.8 hand-polishes 20
 *     canonical entries; the remaining ~1,000 take the minimal
 *     shape and get `quality.tests = false`).
 */
import { z } from 'zod'

/**
 * Restricted URL validator used for every URL field in the manifest.
 *
 * Rationale: plain `z.string().url()` uses the WHATWG URL parser, which
 * accepts ANY scheme including `javascript:`, `data:`, and `file:`. Any
 * gallery card, CLI output, or docs page that later renders a field
 * like `deployButton.url` or `author.url` as a clickable link or iframe
 * src would become an XSS/SSRF sink. Restrict to `http://` and
 * `https://` at the schema layer so downstream consumers don't need
 * to re-sanitize.
 *
 * Implementation note: the http/https restriction is expressed as a
 * `.regex()` rather than a `.refine()` callback. Both forms enforce
 * the rule at runtime, but only `.regex()` survives the round-trip
 * through `zod-to-json-schema` — a refine is a user-supplied JS
 * predicate that has no JSON Schema equivalent and is silently
 * dropped, which would mean external validators consuming
 * `schemas/template.schema.json` wouldn't enforce the scheme
 * restriction. Using a regex keeps runtime Zod and the emitted JSON
 * Schema in sync.
 *
 * This is a deliberate, spec-visible strictness hardening over the
 * literal spec shape (`z.string().url()`). See commit message for
 * the hostile-review justification.
 */
const httpUrl = z
  .string()
  .regex(
    /^https?:\/\//i,
    'URL must use http or https scheme (javascript:, data:, file: blocked for XSS/SSRF safety)',
  )
  .url()

export const templateManifestSchema = z
  .object({
    /**
     * Optional pointer to the JSON Schema draft this manifest
     * validates against. Lets IDEs provide intellisense when a
     * template author hand-writes the file.
     */
    $schema: httpUrl.optional(),

    /** URL-safe template id. */
    slug: z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        'slug must be lowercase alphanumeric with hyphens',
      ),

    /** Human-friendly display name. */
    name: z.string().min(1).max(80),

    /** 1-2 sentence blurb shown in gallery cards. */
    description: z.string().min(1).max(400),

    /** Semver major.minor.patch. */
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+$/,
        'version must be semver major.minor.patch',
      ),

    /** Top-level category for filtering in the gallery. */
    category: z.enum([
      'ai',
      'data',
      'devtools',
      'infra',
      'productivity',
      'finance',
      'commerce',
      'media',
      'research',
      'other',
    ]),

    /** Free-form tags — up to 10, each <= 30 chars. */
    tags: z.array(z.string().min(1).max(30)).max(10),

    /** Authorship block. */
    author: z.object({
      name: z.string(),
      url: httpUrl.optional(),
      github: z.string().optional(),
    }),

    /** Git repo coordinates. */
    repo: z.object({
      type: z.literal('git'),
      url: httpUrl,
      directory: z.string().optional(),
    }),

    /** Primary runtime the template targets. */
    runtime: z.enum(['node', 'python', 'bun', 'deno']),

    /** Source languages present in the template. At least one. */
    languages: z.array(z.enum(['ts', 'js', 'py'])).min(1),

    /** Relative path to the entry file (e.g. `src/index.ts`). */
    entry: z.string(),

    /**
     * Pricing model + optional per-call amount. When `model` is
     * `'per-call'`, `perCallUsdCents` is required via the
     * `.refine` below; other models ignore it.
     *
     * `perCallUsdCents` is additionally constrained to `.int().finite()`
     * because the field name literally means "cents" (integer monetary
     * units, Stripe convention) and because `Infinity` would otherwise
     * validate — a hostile-review billing-path bug. This is a strict
     * improvement over the literal spec shape (`z.number()`).
     */
    pricing: z
      .object({
        model: z.enum(['free', 'per-call', 'subscription', 'tiered']),
        perCallUsdCents: z.number().int().finite().nonnegative().optional(),
        currency: z.literal('USD').default('USD'),
      })
      .refine(
        (data) =>
          data.model !== 'per-call' ||
          typeof data.perCallUsdCents === 'number',
        {
          message:
            "pricing.perCallUsdCents is required when pricing.model is 'per-call'",
          path: ['perCallUsdCents'],
        },
      ),

    /** Quality attestation block — drives the quality-gate CI in P2.13. */
    quality: z.object({
      tests: z.boolean(),
      ciPassing: z.boolean().optional(),
      lastVerifiedAt: z.string().datetime().optional(),
    }),

    /** Capability tags (free-form, up to 30). */
    capabilities: z.array(z.string()).max(30),

    /** Gallery screenshots — up to 6. */
    screenshots: z
      .array(
        z.object({
          url: httpUrl,
          alt: z.string(),
        }),
      )
      .max(6)
      .optional(),

    /** Optional demo video. */
    loomUrl: httpUrl.optional(),

    /** One-click deploy button for cloud providers. */
    deployButton: z
      .object({
        provider: z.enum(['vercel', 'render', 'railway', 'fly']),
        url: httpUrl,
      })
      .optional(),

    /** Featured flag for the gallery hero rail. */
    featured: z.boolean().default(false),

    /** Trending rank (1 = top). Populated by the registry builder. */
    trendingRank: z.number().int().positive().optional(),
  })

/** Inferred TypeScript type for a validated manifest. */
export type TemplateManifest = z.infer<typeof templateManifestSchema>

/**
 * Strict validator — throws a ZodError on invalid input. Use when
 * you want the caller to handle / re-throw the error (e.g. a CLI
 * that should crash on a bad manifest so CI turns red).
 */
export function validateTemplateManifest(json: unknown): TemplateManifest {
  return templateManifestSchema.parse(json)
}

/**
 * Lenient validator — never throws. Returns a discriminated union
 * so callers can destructure `{ success, data }` on the happy path
 * and `{ success, errors }` on the error path. Error strings are
 * dot-path prefixed so a bad field jumps out in logs.
 */
export function safeValidateTemplateManifest(
  json: unknown,
):
  | { success: true; data: TemplateManifest }
  | { success: false; errors: string[] } {
  const result = templateManifestSchema.safeParse(json)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map((e) => {
    const pathStr = e.path.join('.')
    return pathStr ? `${pathStr}: ${e.message}` : e.message
  })
  return { success: false, errors }
}
