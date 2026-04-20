/**
 * Directory-submission packet builder (P3.7).
 *
 * Reads `directories.json` + `project-metadata.ts` and emits one
 * `packets/<slug>.md` per directory plus a top-level `packets/README.md`
 * founder's-checklist index.
 *
 * Packet content is strictly derived from the two sources of truth; no
 * LLM calls at build time. This keeps output deterministic, testable,
 * and inspectable.
 *
 * Usage:
 *   npx tsx scripts/directory-submissions/build.ts
 *   npx tsx scripts/directory-submissions/build.ts --strict
 *   npx tsx scripts/directory-submissions/build.ts --only cline-mcp-marketplace
 *
 * Flags:
 *   --strict    Fail hard on any validation error (e.g., description
 *               exceeds declared char limit). Default: warn on stderr.
 *   --only <s>  Only build the packet for directory slug <s>.
 *
 * Mirrors the node-native, minimal-deps style of build-registry.ts.
 */

import { realpathSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { projectMetadata, type ProjectMetadata } from './project-metadata.js'

// ── Paths ──────────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIRECTORIES_JSON = join(SCRIPT_DIR, 'directories.json')
const DEFAULT_PACKETS_DIR = join(SCRIPT_DIR, 'packets')

// ── Types ──────────────────────────────────────────────────────────────────

export type SubmissionType =
  | 'pr'
  | 'issue'
  | 'form'
  | 'email'
  | 'cli'
  | 'gallery'
  | 'hybrid'
  | 'unknown'

export type SubmissionStatus = 'verified' | 'partial' | 'unverified'

export type DescriptionVariant = 'short' | 'medium' | 'long'

export interface CharLimit {
  max: number
  source: string
}

export interface PrFormat {
  file: string
  categoryHint: string
  entryTemplate: string
}

export interface Directory {
  slug: string
  name: string
  homepage: string
  submissionType: SubmissionType
  submissionUrl: string | null
  submissionStatus: SubmissionStatus
  requiredFields: string[]
  charLimits: Record<string, CharLimit>
  logoRequirement: {
    width: number
    height: number
    format: 'png' | 'svg' | 'jpg'
  } | null
  descriptionVariant: DescriptionVariant
  prFormat: PrFormat | null
  instructions: string
  notes: string
}

export interface DirectoriesFile {
  schemaVersion: number
  verifiedAt: string
  directories: Directory[]
}

export interface BuildPacketsOptions {
  directoriesJsonPath?: string
  outputDir?: string
  strict?: boolean
  only?: string
  /** Override project metadata for testing. Default: imported `projectMetadata`. */
  project?: ProjectMetadata
}

export interface ValidationWarning {
  slug: string
  field: string
  message: string
}

export interface BuildResult {
  packets: { slug: string; path: string; lengthBytes: number }[]
  warnings: ValidationWarning[]
  indexPath: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a GitHub web URL into { owner, repo }.
 * Accepts `https://github.com/owner/repo` and `https://github.com/owner/repo.git`.
 */
export function parseGithubUrl(url: string): { owner: string; repo: string } {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/)
  if (!m) throw new Error(`Not a GitHub web URL: ${url}`)
  return { owner: m[1], repo: m[2] }
}

/**
 * Pick a description variant from project metadata.
 */
export function pickDescription(
  project: ProjectMetadata,
  variant: DescriptionVariant,
): string {
  switch (variant) {
    case 'short':
      return project.descriptionShort
    case 'medium':
      return project.descriptionMedium
    case 'long':
      return project.descriptionLong
  }
}

/**
 * Validate that the chosen description fits within the directory's
 * declared char limit for its chosen variant field (if any). Returns
 * zero or more warnings; does not throw.
 */
export function validateDirectory(
  dir: Directory,
  project: ProjectMetadata,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Core invariants.
  if (!dir.slug || !/^[a-z0-9-]+$/.test(dir.slug)) {
    warnings.push({
      slug: dir.slug || '<missing>',
      field: 'slug',
      message: `Slug must match /^[a-z0-9-]+$/ (got: ${JSON.stringify(dir.slug)})`,
    })
  }
  if (!dir.name) {
    warnings.push({ slug: dir.slug, field: 'name', message: 'name is empty' })
  }
  if (!dir.homepage.startsWith('https://')) {
    warnings.push({
      slug: dir.slug,
      field: 'homepage',
      message: `homepage should be an HTTPS URL (got: ${dir.homepage})`,
    })
  }
  if (
    dir.submissionUrl !== null &&
    !dir.submissionUrl.startsWith('https://')
  ) {
    warnings.push({
      slug: dir.slug,
      field: 'submissionUrl',
      message: `submissionUrl should be an HTTPS URL or null (got: ${dir.submissionUrl})`,
    })
  }

  // Description fits its declared char limit. The variant maps to one of
  // three canonical field names:
  //   short -> `description` (most common form field name)
  //   medium -> `description` or `shortDescription`
  //   long -> `description` or `descriptionLong`
  // Any charLimit whose key looks like a description field is checked.
  const description = pickDescription(project, dir.descriptionVariant)
  const DESCRIPTION_FIELDS = [
    'description',
    'descriptionShort',
    'descriptionMedium',
    'descriptionLong',
    'shortDescription',
  ]
  for (const field of DESCRIPTION_FIELDS) {
    const limit = dir.charLimits[field]
    if (!limit) continue
    if (description.length > limit.max) {
      warnings.push({
        slug: dir.slug,
        field,
        message: `Description (variant=${dir.descriptionVariant}, length=${description.length}) exceeds declared ${field} limit ${limit.max}. Source: ${limit.source}`,
      })
    }
  }

  // Required-field sanity. Each required field must be populatable from
  // projectMetadata; a hard-coded list of known-mappable keys.
  const KNOWN_REQUIRED_FIELDS = new Set([
    'name',
    'repoUrl',
    'description',
    'descriptionShort',
    'descriptionLong',
    'shortDescription',
    'link',
    'serverUrl',
    'publicHttpsUrl',
    'namespaceAndName',
    'category',
    'contactEmail',
    'logoPng400',
    'installTestConfirmation',
    'stabilityConfirmation',
    'mcpRegistryPublication',
    'serverName',
  ])
  for (const f of dir.requiredFields) {
    if (!KNOWN_REQUIRED_FIELDS.has(f)) {
      warnings.push({
        slug: dir.slug,
        field: 'requiredFields',
        message: `Unknown required field ${JSON.stringify(f)}; add it to KNOWN_REQUIRED_FIELDS in build.ts or fix the typo`,
      })
    }
  }

  // PR directories must declare a prFormat so the packet can render a diff.
  if (dir.submissionType === 'pr' && !dir.prFormat) {
    warnings.push({
      slug: dir.slug,
      field: 'prFormat',
      message: 'PR-type directory must declare prFormat with file/categoryHint/entryTemplate',
    })
  }

  return warnings
}

/**
 * Render a single packet as markdown.
 */
export function renderPacket(
  dir: Directory,
  project: ProjectMetadata,
): string {
  const { owner, repo } = parseGithubUrl(project.urls.github)
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main`

  const description = pickDescription(project, dir.descriptionVariant)
  const tagsCsv = project.tags.join(', ')
  const tagsHashed = project.tags.map((t) => `#${t}`).join(' ')

  const sections: string[] = []

  // Header
  sections.push(`# Submission Packet — ${dir.name}`)
  sections.push('')
  sections.push(`**Directory:** ${dir.homepage}`)
  sections.push(`**Submission type:** \`${dir.submissionType}\``)
  sections.push(`**Submission status:** \`${dir.submissionStatus}\` (verified upstream 2026-04-20)`)
  if (dir.submissionUrl) {
    sections.push(`**Submission entry URL:** ${dir.submissionUrl}`)
  } else {
    sections.push(`**Submission entry URL:** _none — see instructions below for the manual path_`)
  }
  sections.push('')

  // Status-specific banner.
  if (dir.submissionStatus === 'partial') {
    sections.push('> ⚠️ **Partial verification.** Some fields below are best-effort — verify the live form schema at submission time and update this packet.')
    sections.push('')
  }
  if (dir.submissionStatus === 'unverified') {
    sections.push('> 🛑 **Unverified directory.** The submission path was not confirmable during scaffold research. Do not submit blindly — follow the action items in the instructions section to verify the directory is live and legitimate first.')
    sections.push('')
  }

  // Paste-ready values
  sections.push('## 1. Paste-ready values')
  sections.push('')
  sections.push('### Name')
  sections.push('```')
  sections.push(project.name)
  sections.push('```')
  sections.push('')
  sections.push('### Tagline')
  sections.push('```')
  sections.push(project.tagline)
  sections.push('```')
  sections.push('')
  sections.push(`### Description (${dir.descriptionVariant} variant, ${description.length} chars)`)
  sections.push('```')
  sections.push(description)
  sections.push('```')
  sections.push('')
  sections.push('### Tags (CSV)')
  sections.push('```')
  sections.push(tagsCsv)
  sections.push('```')
  sections.push('')
  sections.push('### Tags (hashtag format)')
  sections.push('```')
  sections.push(tagsHashed)
  sections.push('```')
  sections.push('')
  sections.push('### Links')
  sections.push(`- Homepage: ${project.urls.homepage}`)
  sections.push(`- GitHub: ${project.urls.github}`)
  sections.push(`- NPM package: ${project.urls.npmPackage}`)
  sections.push(`- Docs: ${project.urls.docs}`)
  if (project.urls.demo) {
    sections.push(`- Demo: ${project.urls.demo}`)
  } else {
    sections.push(`- Demo: _not yet published — leave blank or use the homepage if the form requires a value_`)
  }
  sections.push('')
  sections.push(`### Contact`)
  sections.push(`- Author: ${project.author.name} (@${project.author.githubHandle})`)
  sections.push(`- Email: ${project.author.email}`)
  sections.push('')

  // Logo / screenshots
  sections.push('## 2. Assets')
  sections.push('')
  if (dir.logoRequirement) {
    const { width, height, format } = dir.logoRequirement
    sections.push(
      `This directory requires a **${width}×${height} ${format.toUpperCase()}** logo. None of the on-disk logo files match that exact spec, so you'll need to convert:`,
    )
    sections.push('')
    sections.push(`- Source SVG: \`${project.logo[0].path}\``)
    sections.push(`- Conversion (using \`sharp-cli\`):`)
    sections.push('  ```sh')
    sections.push(
      `  npx sharp-cli -i ${project.logo[0].path} -o /tmp/settlegrid-${width}.${format} resize ${width} ${height}`,
    )
    sections.push('  ```')
    sections.push('- Alternative: use an online SVG→PNG converter and upload `/tmp/settlegrid-<size>.png` to the submission form.')
    sections.push('')
  } else {
    sections.push('No specific logo format declared by this directory; the SVG logos below are typically accepted.')
    sections.push('')
    for (const logo of project.logo) {
      const raw = `${rawBase}/${logo.path.replace(/ /g, '%20')}`
      sections.push(`- \`${logo.path}\` (${logo.format}, ${logo.description})`)
      sections.push(`  Raw URL: ${raw}`)
    }
    sections.push('')
  }

  sections.push('### Screenshots')
  sections.push('')
  sections.push(
    'The following screenshots are in the repo and can be attached directly or linked via the raw URL:',
  )
  sections.push('')
  for (const ss of project.screenshots) {
    const raw = `${rawBase}/${ss.replace(/ /g, '%20')}`
    sections.push(`- \`${ss}\``)
    sections.push(`  Raw URL: ${raw}`)
  }
  sections.push('')

  // PR-only: diff
  if (dir.prFormat) {
    sections.push('## 3. Exact PR diff')
    sections.push('')
    sections.push(`Place the following bullet in \`${dir.prFormat.file}\`.`)
    sections.push(
      `Suggested category: **${dir.prFormat.categoryHint}**. If the category does not exist, the PR effectively proposes adding it — justify in the PR description.`,
    )
    sections.push('')
    const bullet = dir.prFormat.entryTemplate
      .replace('{name}', project.name)
      .replace('{github}', project.urls.github)
      .replace('{homepage}', project.urls.homepage)
      .replace('{description}', description)
      .replace(
        'icon-url',
        `${rawBase}/${project.logo[3]?.path.replace(/ /g, '%20') ?? 'apps/web/public/favicon-32.png'}`,
      )
    sections.push('```diff')
    sections.push(`+${bullet}`)
    sections.push('```')
    sections.push('')
    sections.push('Commit message:')
    sections.push('```')
    sections.push(`Add ${project.name} (${project.tagline.toLowerCase()})`)
    sections.push('```')
    sections.push('')
  }

  // Step-by-step instructions
  const stepHeaderIdx = dir.prFormat ? 4 : 3
  sections.push(`## ${stepHeaderIdx}. Step-by-step submission`)
  sections.push('')
  sections.push(dir.instructions)
  sections.push('')

  // Required fields + limits
  sections.push(`## ${stepHeaderIdx + 1}. Fields & limits`)
  sections.push('')
  if (dir.requiredFields.length > 0) {
    sections.push('**Required fields (known at scaffold time):**')
    sections.push('')
    for (const f of dir.requiredFields) {
      sections.push(`- \`${f}\``)
    }
    sections.push('')
  } else {
    sections.push('No required fields are known at scaffold time.')
    sections.push('')
  }
  if (Object.keys(dir.charLimits).length > 0) {
    sections.push('**Character limits:**')
    sections.push('')
    sections.push('| Field | Max | Source |')
    sections.push('|-------|-----|--------|')
    for (const [field, limit] of Object.entries(dir.charLimits)) {
      sections.push(`| \`${field}\` | ${limit.max} | ${limit.source} |`)
    }
    sections.push('')
  }

  // Notes + footer
  sections.push(`## ${stepHeaderIdx + 2}. Notes`)
  sections.push('')
  sections.push(dir.notes)
  sections.push('')
  sections.push(`## ${stepHeaderIdx + 3}. Founder checklist`)
  sections.push('')
  sections.push('- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)')
  if (dir.logoRequirement) {
    sections.push(`- [ ] Logo converted to ${dir.logoRequirement.width}×${dir.logoRequirement.height} ${dir.logoRequirement.format}`)
  }
  sections.push('- [ ] Required fields populated from section 1')
  sections.push('- [ ] Description pasted verbatim (no silent rewrites that inflate scope)')
  sections.push('- [ ] Submission sent')
  sections.push('- [ ] Confirmation / review URL captured')
  sections.push('- [ ] Status updated in `packets/README.md`')
  sections.push('')

  return sections.join('\n')
}

/**
 * Render the top-level packets/README.md founder checklist.
 */
export function renderIndex(
  directories: Directory[],
  project: ProjectMetadata,
): string {
  const lines: string[] = []
  lines.push('# Directory Submission Packets — Founder Checklist')
  lines.push('')
  lines.push(`Generated by \`scripts/directory-submissions/build.ts\` from \`directories.json\` and \`project-metadata.ts\`.`)
  lines.push('')
  lines.push(`**Project:** ${project.name} — ${project.tagline}`)
  lines.push(`**Homepage:** ${project.urls.homepage}`)
  lines.push(`**GitHub:** ${project.urls.github}`)
  lines.push('')
  lines.push('## How to use this')
  lines.push('')
  lines.push('Each row links to a packet file containing (1) paste-ready values (name, description at the correct length, tags, URLs), (2) asset paths + raw URLs, (3) step-by-step submission instructions, and — for PR-type directories — (4) an exact diff to commit against a fork.')
  lines.push('')
  lines.push('Process each directory row as follows:')
  lines.push('1. Open the packet file.')
  lines.push('2. Verify the submission path is still live (especially `partial` / `unverified` rows).')
  lines.push('3. Follow the step-by-step instructions.')
  lines.push('4. Update the `Status` column below when sent / accepted / rejected.')
  lines.push('')
  lines.push('Regenerate packets any time project metadata changes: `npx tsx scripts/directory-submissions/build.ts`.')
  lines.push('')
  lines.push('## Submission tracker')
  lines.push('')
  lines.push('| # | Directory | Type | Verification | Packet | Status | Sent | Result URL |')
  lines.push('|---|-----------|------|--------------|--------|--------|------|------------|')
  directories.forEach((dir, i) => {
    const num = String(i + 1).padStart(2, '0')
    lines.push(
      `| ${num} | [${dir.name}](${dir.homepage}) | \`${dir.submissionType}\` | \`${dir.submissionStatus}\` | [\`${dir.slug}.md\`](./${dir.slug}.md) | not-sent | — | — |`,
    )
  })
  lines.push('')
  lines.push('### Status values')
  lines.push('')
  lines.push('- `not-sent` — Packet is ready but the submission has not been filed.')
  lines.push('- `sent` — Submission filed; awaiting directory review.')
  lines.push('- `accepted` — Directory accepted the listing; record the result URL in the table.')
  lines.push('- `rejected` — Directory declined; note the reason in the Notes section below and consider whether to resubmit.')
  lines.push('- `skip` — Intentionally skipped (e.g., directory turned out to be abandoned, scope-mismatched, or low-signal after verification).')
  lines.push('')
  lines.push('## Notes & outcomes')
  lines.push('')
  lines.push('_(Add a per-directory note here as you process each row — e.g., "2026-04-21: Cline rejected because llms-install.md missing; fix filed in commit abc1234 and resubmitted.")_')
  lines.push('')
  lines.push('## Regeneration')
  lines.push('')
  lines.push('This file is generated. Manual edits to the submission tracker table (Status/Sent/Result URL columns) survive regeneration **only if** you add them to a separate tracker file or commit them after running the builder. Current builder behavior: the full file is overwritten on every run.')
  lines.push('')
  lines.push('_TODO for a future iteration: persist per-directory status in a sidecar file and preserve it across runs. Scaffold-time design ships the overwrite-everything version to keep the build logic simple._')
  lines.push('')
  return lines.join('\n')
}

// ── Core ───────────────────────────────────────────────────────────────────

export async function loadDirectories(
  path: string,
): Promise<DirectoriesFile> {
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw) as unknown
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('directories' in parsed) ||
    !Array.isArray((parsed as { directories: unknown[] }).directories)
  ) {
    throw new Error(`${path} does not have a valid {directories: Directory[]} shape`)
  }
  return parsed as DirectoriesFile
}

export async function buildPackets(
  opts: BuildPacketsOptions = {},
): Promise<BuildResult> {
  const directoriesPath = opts.directoriesJsonPath ?? DEFAULT_DIRECTORIES_JSON
  const outputDir = opts.outputDir ?? DEFAULT_PACKETS_DIR
  const strict = opts.strict ?? false
  const only = opts.only
  const project = opts.project ?? projectMetadata

  const file = await loadDirectories(directoriesPath)
  let directories = file.directories

  if (only) {
    directories = directories.filter((d) => d.slug === only)
    if (directories.length === 0) {
      throw new Error(`No directory with slug ${JSON.stringify(only)}`)
    }
  }

  // Determinism: sort by slug before writing so the generated index is
  // stable across minor edits to `directories.json` ordering.
  const sorted = [...directories].sort((a, b) => a.slug.localeCompare(b.slug))

  const warnings: ValidationWarning[] = []
  for (const dir of sorted) {
    warnings.push(...validateDirectory(dir, project))
  }

  // Duplicate-slug detection
  const seen = new Set<string>()
  for (const dir of sorted) {
    if (seen.has(dir.slug)) {
      warnings.push({
        slug: dir.slug,
        field: 'slug',
        message: 'Duplicate slug',
      })
    }
    seen.add(dir.slug)
  }

  if (strict && warnings.length > 0) {
    const lines = warnings.map(
      (w) => `  [${w.slug}] ${w.field}: ${w.message}`,
    )
    throw new Error(
      `Strict mode: ${warnings.length} validation warning(s):\n${lines.join('\n')}`,
    )
  }

  for (const w of warnings) {
    console.warn(`WARN: [${w.slug}] ${w.field}: ${w.message}`)
  }

  await mkdir(outputDir, { recursive: true })

  const packets: BuildResult['packets'] = []
  for (const dir of sorted) {
    const packetPath = join(outputDir, `${dir.slug}.md`)
    const content = renderPacket(dir, project) + '\n'
    await writeFile(packetPath, content, 'utf-8')
    packets.push({ slug: dir.slug, path: packetPath, lengthBytes: content.length })
  }

  const indexPath = join(outputDir, 'README.md')
  // Pass the full (possibly filtered) sorted list to renderIndex so --only
  // still produces a coherent (if single-row) index.
  const indexContent = renderIndex(sorted, project) + '\n'
  await writeFile(indexPath, indexContent, 'utf-8')

  console.log(`Built ${packets.length} packet(s) → ${outputDir}`)
  if (warnings.length > 0) {
    console.log(`  ${warnings.length} validation warning(s) logged to stderr`)
  }

  return { packets, warnings, indexPath }
}

// ── CLI entry ──────────────────────────────────────────────────────────────

function isMainEntry(): boolean {
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url))
    const entryPath = realpathSync(process.argv[1])
    return scriptPath === entryPath
  } catch {
    return false
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const strict = argv.includes('--strict') || !!process.env.CI

  let only: string | undefined
  const onlyIdx = argv.indexOf('--only')
  if (onlyIdx !== -1) {
    only = argv[onlyIdx + 1]
    if (!only || only.startsWith('--')) {
      console.error(
        `Error: --only requires a slug argument (got ${only ? `'${only}'` : 'nothing'})`,
      )
      process.exitCode = 1
      return
    }
  }

  try {
    await buildPackets({ strict, only })
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  }
}

if (isMainEntry()) {
  main()
}
