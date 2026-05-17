import prompts from 'prompts'
import pc from 'picocolors'
import path from 'node:path'
import { scaffold } from './scaffold.js'
import { banner } from './banner.js'
import { parseArgs } from './args.js'
import { readPackageVersion } from './version.js'
import {
  downloadGalleryTemplate,
  defaultGalleryDir,
  isValidGallerySlug,
  ScaffoldError,
} from './gallery.js'
import {
  captureScaffoldFailed,
  captureScaffoldSuccess,
  type ScaffoldErrorCode,
} from './telemetry.js'
import type { ToolConfig } from './types.js'

const CATEGORIES = [
  { title: 'Data', value: 'data' },
  { title: 'NLP', value: 'nlp' },
  { title: 'Search', value: 'search' },
  { title: 'Finance', value: 'finance' },
  { title: 'Code', value: 'code' },
  { title: 'Security', value: 'security' },
  { title: 'Analytics', value: 'analytics' },
  { title: 'Other', value: 'other' },
] as const

const PRICING_MODELS = [
  { title: 'Per call', value: 'per-call' },
  { title: 'Per token', value: 'per-token' },
  { title: 'Per byte', value: 'per-byte' },
] as const

const TEMPLATES = [
  { title: 'Blank — minimal settlegrid.init() + sg.wrap()', value: 'blank' },
  { title: 'REST API — Express.js server with billing middleware', value: 'rest-api' },
  { title: 'OpenAPI — scaffold from an OpenAPI spec', value: 'openapi' },
  { title: 'MCP Server — full MCP server with stdio transport', value: 'mcp-server' },
] as const

const DEPLOY_TARGETS = [
  { title: 'Vercel', value: 'vercel' },
  { title: 'Railway', value: 'railway' },
  { title: 'Docker', value: 'docker' },
  { title: 'None', value: 'none' },
] as const

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function helpText(): string {
  return `
  ${pc.bold('Usage:')}
    ${pc.cyan('npx create-settlegrid-tool')} ${pc.dim('[directory]')}
    ${pc.cyan('npx create-settlegrid-tool --template')} ${pc.dim('<slug> [directory]')}

  ${pc.dim('Create a monetized AI tool project with SettleGrid billing.')}

  ${pc.bold('Modes:')}
    ${pc.dim('Interactive')}   Run with no ${pc.cyan('--template')} flag to pick a starter
                  archetype (blank, rest-api, openapi, mcp-server).
    ${pc.dim('Gallery')}       Pass ${pc.cyan('--template <slug>')} to scaffold one of the
                  published templates from ${pc.underline('https://settlegrid.ai/templates')}.

  ${pc.bold('Options:')}
    ${pc.cyan('--template <slug>')}   Gallery template slug, e.g. ${pc.dim('tmdb')} (non-interactive)
    ${pc.cyan('[directory]')}         Target directory (default: ${pc.dim('settlegrid-<slug>')} in
                        gallery mode, or prompted in interactive mode)
    ${pc.cyan('--help, -h')}          Show this help message
    ${pc.cyan('--version')}           Show version
`
}

/** Map an interactive-scaffold (`scaffold.ts`) failure to a telemetry code. */
function mapInteractiveError(err: unknown): ScaffoldErrorCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (msg.includes('already exists')) return 'write_failed'
  if (msg.includes('not found')) return 'template_not_found'
  return 'unknown'
}

/**
 * Gallery mode: `create-settlegrid-tool --template <slug> [directory]`.
 *
 * Fully non-interactive — it is the command the gallery's Copy-Install
 * button pastes into a terminal. Downloads the published template repo
 * and emits `scaffold_success` / `scaffold_failed` telemetry.
 */
async function runGalleryMode(
  slug: string,
  directoryArg: string | undefined,
): Promise<void> {
  const scaffoldStart = Date.now()
  const trimmedSlug = slug.trim()

  // template_slug for telemetry: the real slug when it is well-formed
  // (a public registry coordinate — no PII), else a fixed placeholder
  // so a malformed/garbage value is never echoed into PostHog.
  const telemetrySlug = isValidGallerySlug(trimmedSlug)
    ? trimmedSlug
    : '(invalid)'

  const directory = directoryArg ?? defaultGalleryDir(trimmedSlug)
  const targetDir = path.resolve(process.cwd(), directory)

  console.log(
    pc.dim(`  Scaffolding "${trimmedSlug}" from the SettleGrid gallery...`),
  )
  console.log()

  try {
    await downloadGalleryTemplate(trimmedSlug, targetDir)
  } catch (err) {
    const code: ScaffoldErrorCode =
      err instanceof ScaffoldError ? err.code : 'unknown'
    const message = err instanceof Error ? err.message : String(err)
    console.error(pc.red('  Scaffold failed: ') + message)
    if (code === 'template_not_found') {
      console.error(
        pc.dim('  Browse available templates at ') +
          pc.cyan('https://settlegrid.ai/templates'),
      )
    }
    console.error()
    process.exitCode = 1
    // Fire-and-forget: the pending POST is an active handle that keeps
    // the process alive until it resolves or the 2s timeout aborts, so
    // we must NOT call process.exit() here.
    void captureScaffoldFailed({
      template_slug: telemetrySlug,
      error_code: code,
    })
    return
  }

  console.log(pc.green(pc.bold('  Done!')) + ' Template ready.\n')
  console.log(`  ${pc.dim('$')} ${pc.cyan(`cd ${directory}`)}`)
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm install')}`)
  console.log(
    `  ${pc.dim('$')} ${pc.cyan('cp .env.example .env')}   ${pc.dim('# add your API keys')}`,
  )
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm run dev')}\n`)
  console.log(
    pc.dim('  Register your tool to start earning: ') +
      pc.cyan(pc.underline('https://settlegrid.ai/dashboard/tools')) +
      '\n',
  )

  void captureScaffoldSuccess({
    template_slug: telemetrySlug,
    duration_ms: Date.now() - scaffoldStart,
  })
}

/**
 * Interactive mode: `create-settlegrid-tool [directory]`.
 *
 * Prompts for project options and scaffolds from one of the bundled
 * starter archetypes. Emits `scaffold_success` / `scaffold_failed`.
 */
async function runInteractiveMode(
  directoryArg: string | undefined,
): Promise<void> {
  let cancelled = false

  const response = await prompts(
    [
      {
        type: directoryArg ? null : 'text',
        name: 'directory',
        message: 'Project directory',
        initial: 'my-tool',
        validate: (v: string) =>
          v.length > 0 ? true : 'Directory name is required',
      },
      {
        type: 'text',
        name: 'toolName',
        message: 'Tool name',
        initial: (prev: string) => prev || directoryArg || 'my-tool',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description',
        initial: 'A monetized AI tool powered by SettleGrid',
      },
      {
        type: 'select',
        name: 'category',
        message: 'Category',
        choices: [...CATEGORIES],
      },
      {
        type: 'select',
        name: 'pricingModel',
        message: 'Pricing model',
        choices: [...PRICING_MODELS],
      },
      {
        type: 'number',
        name: 'priceCents',
        message: 'Default price per call (cents)',
        initial: 2,
        min: 0,
      },
      {
        type: 'select',
        name: 'template',
        message: 'Template',
        choices: [...TEMPLATES],
      },
      {
        type: 'select',
        name: 'deployTarget',
        message: 'Deploy target',
        choices: [...DEPLOY_TARGETS],
      },
    ],
    {
      onCancel: () => {
        cancelled = true
      },
    },
  )

  if (cancelled) {
    console.log(pc.red('\nSetup cancelled.'))
    process.exit(1)
  }

  const directory = directoryArg || response.directory
  const toolSlug = toSlug(directory)
  const targetDir = path.resolve(process.cwd(), directory)

  const config: ToolConfig = {
    directory,
    toolName: response.toolName || directory,
    toolSlug,
    description:
      response.description || 'A monetized AI tool powered by SettleGrid',
    category: response.category || 'other',
    pricingModel: response.pricingModel || 'per-call',
    priceCents: response.priceCents ?? 2,
    template: response.template || 'blank',
    deployTarget: response.deployTarget || 'none',
    targetDir,
  }

  console.log()
  console.log(pc.dim('  Scaffolding project...'))
  console.log()

  const scaffoldStart = Date.now()
  try {
    await scaffold(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(pc.red('  Scaffold failed: ') + message + '\n')
    process.exitCode = 1
    void captureScaffoldFailed({
      template_slug: config.template,
      error_code: mapInteractiveError(err),
    })
    return
  }

  console.log(pc.green(pc.bold('  Done!')) + ' Your tool is ready.\n')
  console.log(`  ${pc.dim('$')} ${pc.cyan(`cd ${directory}`)}`)
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm install')}`)
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm run dev')}\n`)
  console.log(
    pc.dim('  Next: Register your tool at ') +
      pc.cyan(pc.underline('https://settlegrid.ai/dashboard/tools')) +
      '\n',
  )

  void captureScaffoldSuccess({
    template_slug: config.template,
    duration_ms: Date.now() - scaffoldStart,
  })
}

async function main(): Promise<void> {
  const version = readPackageVersion()
  const args = parseArgs(process.argv.slice(2))

  console.log(banner(version))

  if (args.help) {
    console.log(helpText())
    process.exit(0)
  }

  if (args.version) {
    console.log(version)
    process.exit(0)
  }

  // `template` is defined (possibly as '') iff `--template` was passed.
  if (args.template !== undefined) {
    await runGalleryMode(args.template, args.directory)
    return
  }

  await runInteractiveMode(args.directory)
}

main().catch((err) => {
  console.error(pc.red('Error:'), err instanceof Error ? err.message : err)
  process.exit(1)
})
