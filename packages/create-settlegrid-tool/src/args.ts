/**
 * argv parsing for `create-settlegrid-tool`.
 *
 * Two invocation shapes:
 *   - Interactive:  `create-settlegrid-tool [directory]`
 *   - Gallery mode: `create-settlegrid-tool --template <slug> [directory]`
 *
 * Plus `--help` / `-h` and `--version`. Kept dependency-free and
 * pure so it can be unit-tested without spawning the binary.
 */

export interface ParsedArgs {
  /**
   * Gallery template slug from `--template <slug>` or
   * `--template=<slug>`. Present (possibly as an empty string when
   * the flag was passed with no value) iff gallery mode was
   * requested; `undefined` means interactive mode.
   */
  template?: string
  /** Positional directory argument (the first non-flag token). */
  directory?: string
  /** `--help` / `-h` was passed. */
  help: boolean
  /** `--version` was passed. */
  version: boolean
}

const TEMPLATE_EQ_PREFIX = '--template='

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { help: false, version: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--version') {
      result.version = true
    } else if (arg === '--template') {
      // `--template <value>` — consume the next token, unless it is
      // itself a flag (or absent), in which case record an empty
      // string so the caller can surface a clear "missing slug"
      // error rather than silently dropping into interactive mode.
      const next: string | undefined = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        result.template = next
        i++
      } else {
        result.template = ''
      }
    } else if (arg.startsWith(TEMPLATE_EQ_PREFIX)) {
      result.template = arg.slice(TEMPLATE_EQ_PREFIX.length)
    } else if (arg.startsWith('-')) {
      // Unknown flag — ignore (forward-compatible; don't hard-fail).
    } else if (result.directory === undefined) {
      result.directory = arg
    }
  }

  return result
}
