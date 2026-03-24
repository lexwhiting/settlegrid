import pc from 'picocolors'

export function banner(): string {
  const emerald = pc.green
  const dim = pc.dim

  const art = `
${emerald('   ___      _   _   _       ___      _    _ ')}
${emerald('  / __| ___| |_| |_| |___  / __|_ __(_)__| |')}
${emerald('  \\__ \\/ -_)  _|  _| / -_)| (_ | \'_| / _` |')}
${emerald('  |___/\\___|\\__|\\__|_\\___| \\___|_| |_\\__,_|')}
`

  const tagline = dim('  The Settlement Layer for the AI Economy')
  const version = dim('  v1.0.0')
  const separator = dim('  ' + '-'.repeat(44))

  return `${art}${tagline}\n${version}\n${separator}\n`
}
