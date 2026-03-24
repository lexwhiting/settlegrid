import prompts from 'prompts'
import pc from 'picocolors'
import path from 'node:path'
import { scaffold } from './scaffold.js'
import { banner } from './banner.js'
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

async function main() {
  console.log(banner())

  const dirArg = process.argv[2]

  if (dirArg === '--help' || dirArg === '-h') {
    console.log(`
  ${pc.bold('Usage:')} npx create-settlegrid-tool ${pc.cyan('[directory]')}

  ${pc.dim('Creates a monetized AI tool project with SettleGrid billing.')}

  ${pc.bold('Options:')}
    ${pc.cyan('[directory]')}   Project directory name (default: prompted)
    ${pc.cyan('--help, -h')}   Show this help message
    ${pc.cyan('--version')}    Show version
`)
    process.exit(0)
  }

  if (dirArg === '--version') {
    console.log('1.0.0')
    process.exit(0)
  }

  let cancelled = false

  const response = await prompts(
    [
      {
        type: dirArg ? null : 'text',
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
        initial: (prev: string) => prev || dirArg || 'my-tool',
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
    }
  )

  if (cancelled) {
    console.log(pc.red('\nSetup cancelled.'))
    process.exit(1)
  }

  const directory = dirArg || response.directory
  const toolSlug = toSlug(directory)
  const targetDir = path.resolve(process.cwd(), directory)

  const config: ToolConfig = {
    directory,
    toolName: response.toolName || directory,
    toolSlug,
    description: response.description || 'A monetized AI tool powered by SettleGrid',
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

  await scaffold(config)

  console.log(pc.green(pc.bold('  Done!')) + ' Your tool is ready.\n')
  console.log(`  ${pc.dim('$')} ${pc.cyan(`cd ${directory}`)}`)
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm install')}`)
  console.log(`  ${pc.dim('$')} ${pc.cyan('npm run dev')}\n`)
  console.log(
    pc.dim('  Next: Register your tool at ') +
      pc.cyan(pc.underline('https://settlegrid.ai/dashboard/tools')) +
      '\n'
  )
}

main().catch((err) => {
  console.error(pc.red('Error:'), err instanceof Error ? err.message : err)
  process.exit(1)
})
