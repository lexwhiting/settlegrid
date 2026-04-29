import { Command } from 'commander'
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addCommand } from './commands/add.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgPath = path.resolve(here, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>
const version =
  typeof pkg.version === 'string' && pkg.version.length > 0
    ? pkg.version
    : 'unknown'

const program = new Command()

program
  .name('settlegrid')
  .description(
    'SettleGrid CLI — monetize any MCP server, REST API, or AI agent with one command.',
  )
  .version(version, '-v, --version', 'print the CLI version and exit')

addCommand(program)

/**
 * True only when this file is the Node entrypoint — i.e. invoked directly
 * as `node dist/index.js` or via the `settlegrid` bin shim. Returns false
 * for `require('@settlegrid/cli')` / `import '@settlegrid/cli'`, so library
 * consumers don't accidentally trigger CLI parsing + process.exit as a
 * side effect of loading the module.
 *
 * Uses realpathSync on both sides so npm's bin symlink (which is the path
 * Node sees in argv[1]) resolves to the underlying dist file before the
 * equality check — otherwise the gate would false-negative every
 * `npx settlegrid` / globally-installed invocation.
 */
function isMainEntry(): boolean {
  const argvEntry = process.argv[1]
  if (!argvEntry) return false
  try {
    const argvReal = realpathSync(argvEntry)
    const thisReal = realpathSync(fileURLToPath(import.meta.url))
    return argvReal === thisReal
  } catch {
    return false
  }
}

if (isMainEntry()) {
  ;(async () => {
    try {
      await program.parseAsync(process.argv)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`settlegrid: ${message}\n`)
      process.exit(1)
    }
  })()
}
