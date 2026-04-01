/**
 * settlegrid-wcag-checker — WCAG Accessibility Checker MCP Server
 *
 * WCAG Accessibility Checker tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface ContrastInput { foreground: string; background: string }
interface GetGuidelineInput { criterion: string }

function hexToLuminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)!.map(c => { const v = parseInt(c, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

const GUIDELINES: Record<string, { level: string; principle: string; description: string; techniques: string[] }> = {
  '1.1.1': { level: 'A', principle: 'Perceivable', description: 'Non-text content has text alternatives', techniques: ['Add alt text to images', 'Describe complex images', 'Empty alt for decorative images'] },
  '1.4.3': { level: 'AA', principle: 'Perceivable', description: 'Contrast ratio of at least 4.5:1 for text', techniques: ['Use contrast checker', 'Avoid low-contrast text', 'Test with color blindness simulators'] },
  '1.4.6': { level: 'AAA', principle: 'Perceivable', description: 'Contrast ratio of at least 7:1 (enhanced)', techniques: ['Use high-contrast color pairs', 'Provide high-contrast mode'] },
  '2.1.1': { level: 'A', principle: 'Operable', description: 'All functionality accessible via keyboard', techniques: ['Test tab navigation', 'Ensure focus styles visible', 'No keyboard traps'] },
  '2.4.7': { level: 'AA', principle: 'Operable', description: 'Focus indicator is visible', techniques: ['Use focus-visible CSS', 'High contrast focus rings', 'Never outline:none without replacement'] },
  '3.1.1': { level: 'A', principle: 'Understandable', description: 'Language of page is specified', techniques: ['Set lang attribute on html element'] },
  '4.1.2': { level: 'A', principle: 'Robust', description: 'UI components have accessible names and roles', techniques: ['Use semantic HTML', 'Add ARIA labels', 'Test with screen reader'] },
}

const sg = settlegrid.init({ toolSlug: 'wcag-checker', pricing: { defaultCostCents: 1, methods: {
  check_contrast: { costCents: 1, displayName: 'Check Contrast' },
  get_guideline: { costCents: 1, displayName: 'Get Guideline' },
  list_guidelines: { costCents: 1, displayName: 'List Guidelines' },
}}})

const checkContrast = sg.wrap(async (args: ContrastInput) => {
  if (!args.foreground || !args.background) throw new Error('foreground and background hex colors required')
  const l1 = hexToLuminance(args.foreground); const l2 = hexToLuminance(args.background)
  const ratio = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100
  return { foreground: args.foreground, background: args.background, contrast_ratio: `${ratio}:1`, aa_normal: ratio >= 4.5, aa_large: ratio >= 3, aaa_normal: ratio >= 7, aaa_large: ratio >= 4.5, rating: ratio >= 7 ? 'Excellent (AAA)' : ratio >= 4.5 ? 'Good (AA)' : ratio >= 3 ? 'Acceptable for large text only' : 'Fail' }
}, { method: 'check_contrast' })

const getGuideline = sg.wrap(async (args: GetGuidelineInput) => {
  if (!args.criterion) throw new Error('criterion required (e.g. "1.4.3")')
  const g = GUIDELINES[args.criterion]
  if (!g) throw new Error(`Unknown criterion. Available: ${Object.keys(GUIDELINES).join(', ')}`)
  return { criterion: args.criterion, ...g }
}, { method: 'get_guideline' })

const listGuidelines = sg.wrap(async (_a: Record<string, never>) => {
  return { guidelines: Object.entries(GUIDELINES).map(([id, g]) => ({ id, level: g.level, principle: g.principle, description: g.description })), count: Object.keys(GUIDELINES).length }
}, { method: 'list_guidelines' })

export { checkContrast, getGuideline, listGuidelines }
console.log('settlegrid-wcag-checker MCP server ready | Powered by SettleGrid')
