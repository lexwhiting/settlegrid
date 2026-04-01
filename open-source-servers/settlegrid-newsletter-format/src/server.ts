/**
 * settlegrid-newsletter-format — Newsletter Formatter MCP Server
 *
 * Newsletter Formatter tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface FormatInput { subject: string; sections: Array<{ title: string; body: string; cta_text?: string; cta_url?: string }>; footer?: string }
interface GetTemplateInput { name: string }

const TEMPLATES: Record<string, { name: string; sections: string[]; tone: string }> = {
  weekly_digest: { name: 'Weekly Digest', sections: ['Top Stories', 'Industry News', 'Tip of the Week', 'Upcoming Events'], tone: 'informative' },
  product_update: { name: 'Product Update', sections: ['What\'s New', 'Bug Fixes', 'Coming Soon', 'Feedback Request'], tone: 'enthusiastic' },
  welcome: { name: 'Welcome Email', sections: ['Welcome Message', 'Getting Started', 'Key Features', 'Support Info'], tone: 'warm' },
  monthly_report: { name: 'Monthly Report', sections: ['Executive Summary', 'Key Metrics', 'Highlights', 'Next Steps'], tone: 'professional' },
}

const sg = settlegrid.init({ toolSlug: 'newsletter-format', pricing: { defaultCostCents: 1, methods: {
  format_newsletter: { costCents: 1, displayName: 'Format Newsletter' },
  get_template: { costCents: 1, displayName: 'Get Template' },
  list_templates: { costCents: 1, displayName: 'List Templates' },
}}})

const formatNewsletter = sg.wrap(async (args: FormatInput) => {
  if (!args.subject || !args.sections?.length) throw new Error('subject and sections required')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h1 style="color:#1a1f3a;border-bottom:2px solid #06B6D4;padding-bottom:10px">${args.subject}</h1>
${args.sections.map(s => `<h2 style="color:#333">${s.title}</h2>
<p style="color:#555;line-height:1.6">${s.body}</p>
${s.cta_url ? `<a href="${s.cta_url}" style="display:inline-block;background:#10B981;color:white;padding:10px 24px;text-decoration:none;border-radius:6px;margin:8px 0">${s.cta_text ?? 'Learn More'}</a>` : ''}`).join('\n<hr style="border:none;border-top:1px solid #eee;margin:24px 0">\n')}
${args.footer ? `<footer style="color:#999;font-size:12px;margin-top:24px;padding-top:12px;border-top:1px solid #eee">${args.footer}</footer>` : ''}
</body></html>`
  const wordCount = args.sections.reduce((a, s) => a + s.body.split(' ').length, 0)
  return { html, subject: args.subject, sections: args.sections.length, word_count: wordCount, estimated_read_min: Math.ceil(wordCount / 200) }
}, { method: 'format_newsletter' })

const getTemplate = sg.wrap(async (args: GetTemplateInput) => {
  if (!args.name) throw new Error('name required')
  const t = TEMPLATES[args.name.toLowerCase().replace(/ /g, '_')]
  if (!t) throw new Error(`Unknown template. Available: ${Object.keys(TEMPLATES).join(', ')}`)
  return t
}, { method: 'get_template' })

const listTemplates = sg.wrap(async (_a: Record<string, never>) => {
  return { templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, ...t })), count: Object.keys(TEMPLATES).length }
}, { method: 'list_templates' })

export { formatNewsletter, getTemplate, listTemplates }
console.log('settlegrid-newsletter-format MCP server ready | Powered by SettleGrid')
