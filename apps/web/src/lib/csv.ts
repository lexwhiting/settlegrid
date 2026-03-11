/**
 * Escapes a value for safe inclusion in a CSV cell.
 *
 * Rules:
 * - If the value contains a comma, double-quote, newline, or starts with
 *   a formula trigger character (=, +, -, @), wrap it in double quotes.
 * - Any internal double quotes are doubled ("" per RFC 4180).
 * - Formula trigger characters are prefixed with a single quote inside the
 *   quoted cell to prevent CSV injection in spreadsheet applications.
 */
export function csvEscape(value: string): string {
  const formulaTriggers = ['=', '+', '-', '@']
  const needsQuoting =
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    formulaTriggers.some((ch) => value.startsWith(ch))

  if (!needsQuoting) {
    return value
  }

  // Prefix formula triggers to prevent CSV injection
  let escaped = value
  if (formulaTriggers.some((ch) => escaped.startsWith(ch))) {
    escaped = `'${escaped}`
  }

  // Double any internal quotes
  escaped = escaped.replace(/"/g, '""')

  return `"${escaped}"`
}
