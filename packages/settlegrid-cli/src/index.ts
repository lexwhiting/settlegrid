import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addCommand } from './commands/add.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgPath = path.resolve(here, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }

const program = new Command()

program
  .name('settlegrid')
  .description(
    'SettleGrid CLI — monetize any MCP server, REST API, or AI agent with one command.',
  )
  .version(pkg.version, '-v, --version', 'print the CLI version and exit')

addCommand(program)

;(async () => {
  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`settlegrid: ${message}\n`)
    process.exit(1)
  }
})()
