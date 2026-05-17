import pc from 'picocolors'

/**
 * Render the startup banner. The version is passed in (resolved from
 * package.json by the caller via `readPackageVersion()`) so the
 * displayed `v…` never drifts from the published version.
 */
export function banner(version: string): string {
  const emerald = pc.green
  const dim = pc.dim

  const art = `
${emerald('   ___      _   _   _       ___      _    _ ')}
${emerald('  / __| ___| |_| |_| |___  / __|_ __(_)__| |')}
${emerald('  \\__ \\/ -_)  _|  _| / -_)| (_ | \'_| / _` |')}
${emerald('  |___/\\___|\\__|\\__|_\\___| \\___|_| |_\\__,_|')}
`

  const tagline = dim('  The Settlement Layer for the AI Economy')
  const versionLine = dim(`  v${version}`)
  const separator = dim('  ' + '-'.repeat(44))

  return `${art}${tagline}\n${versionLine}\n${separator}\n`
}
