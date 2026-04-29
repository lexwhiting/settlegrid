/**
 * settlegrid-figlet-text — FIGlet Text Banner MCP Server
 *
 * Renders text as large ASCII art banners using multiple font styles.
 * Pure local implementation with several built-in fonts.
 *
 * Methods:
 *   render(text, font?)           — Render FIGlet text              (1c)
 *   list_fonts()                  — List available fonts            (1c)
 *   render_box(text)              — Render text in a box            (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface RenderInput { text: string; font?: string }
interface RenderBoxInput { text: string; style?: string }

const BLOCK_FONT: Record<string, string[]> = {
  A:['  #  ',' # # ','#####','#   #','#   #'], B:['#### ','#   #','#### ','#   #','#### '],
  C:[' ####','#    ','#    ','#    ',' ####'], D:['#### ','#   #','#   #','#   #','#### '],
  E:['#####','#    ','#### ','#    ','#####'], F:['#####','#    ','#### ','#    ','#    '],
  G:[' ####','#    ','# ###','#   #',' ####'], H:['#   #','#   #','#####','#   #','#   #'],
  I:['#####','  #  ','  #  ','  #  ','#####'], J:['#####','   # ','   # ','#  # ',' ##  '],
  K:['#   #','#  # ','###  ','#  # ','#   #'], L:['#    ','#    ','#    ','#    ','#####'],
  M:['#   #','## ##','# # #','#   #','#   #'], N:['#   #','##  #','# # #','#  ##','#   #'],
  O:[' ### ','#   #','#   #','#   #',' ### '], P:['#### ','#   #','#### ','#    ','#    '],
  Q:[' ### ','#   #','# # #','#  ##',' ####'], R:['#### ','#   #','#### ','#  # ','#   #'],
  S:[' ####','#    ',' ### ','    #','#### '], T:['#####','  #  ','  #  ','  #  ','  #  '],
  U:['#   #','#   #','#   #','#   #',' ### '], V:['#   #','#   #',' # # ',' # # ','  #  '],
  W:['#   #','#   #','# # #','## ##','#   #'], X:['#   #',' # # ','  #  ',' # # ','#   #'],
  Y:['#   #',' # # ','  #  ','  #  ','  #  '], Z:['#####','   # ','  #  ',' #   ','#####'],
  ' ':['     ','     ','     ','     ','     '],
  '0':[' ### ','#   #','#   #','#   #',' ### '], '1':['  #  ',' ##  ','  #  ','  #  ',' ### '],
}

const SHADOW_FONT: Record<string, string[]> = {
  A:['   _   ','  /_\  ',' / _ \\ ','/_/ \\_\\'], B:['  ___ ',' | _ )','| _ \\','|___/'],
  C:['  ___ ',' / __|','| (__ ',' \\___|'], D:['  ___  ',' |   \\ ','| |) |','|___/ '],
  ' ':['    ','    ','    ','    '],
}

function renderFont(text: string, font: Record<string, string[]>, height: number): string {
  const chars = text.toUpperCase().split('')
  const rows: string[] = Array.from({length: height}, () => '')
  for (const c of chars) {
    const glyph = font[c] ?? Array.from({length: height}, () => '?')
    for (let i = 0; i < height; i++) rows[i] += (glyph[i] ?? '') + ' '
  }
  return rows.join('\n')
}

const BOX_STYLES: Record<string, { tl: string; tr: string; bl: string; br: string; h: string; v: string }> = {
  single: { tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518', h: '\u2500', v: '\u2502' },
  double: { tl: '\u2554', tr: '\u2557', bl: '\u255A', br: '\u255D', h: '\u2550', v: '\u2551' },
  rounded: { tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F', h: '\u2500', v: '\u2502' },
  ascii: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
}

const sg = settlegrid.init({
  toolSlug: 'figlet-text',
  pricing: { defaultCostCents: 1, methods: {
    render: { costCents: 1, displayName: 'Render FIGlet' },
    list_fonts: { costCents: 1, displayName: 'List Fonts' },
    render_box: { costCents: 1, displayName: 'Render Box' },
  }},
})

const render = sg.wrap(async (args: RenderInput) => {
  if (!args.text) throw new Error('text required')
  if (args.text.length > 20) throw new Error('text must be 20 characters or fewer')
  const fontName = (args.font ?? 'block').toLowerCase()
  let result: string
  if (fontName === 'shadow') result = renderFont(args.text, SHADOW_FONT, 4)
  else result = renderFont(args.text, BLOCK_FONT, 5)
  return { text: args.text, font: fontName, art: result, width: result.split('\n')[0]?.length ?? 0, height: result.split('\n').length }
}, { method: 'render' })

const listFonts = sg.wrap(async (_a: Record<string, never>) => {
  return { fonts: [
    { name: 'block', height: 5, description: 'Classic block letters with # characters' },
    { name: 'shadow', height: 4, description: 'Shadow-style letters with slashes and backslashes' },
  ]}
}, { method: 'list_fonts' })

const renderBox = sg.wrap(async (args: RenderBoxInput) => {
  if (!args.text) throw new Error('text required')
  const style = BOX_STYLES[(args.style ?? 'single').toLowerCase()] ?? BOX_STYLES.single
  const lines = args.text.split('\n')
  const maxLen = Math.max(...lines.map(l => l.length))
  const top = style.tl + style.h.repeat(maxLen + 2) + style.tr
  const bot = style.bl + style.h.repeat(maxLen + 2) + style.br
  const body = lines.map(l => `${style.v} ${l.padEnd(maxLen)} ${style.v}`).join('\n')
  return { box: `${top}\n${body}\n${bot}`, style: args.style ?? 'single', available_styles: Object.keys(BOX_STYLES) }
}, { method: 'render_box' })

export { render, listFonts, renderBox }
console.log('settlegrid-figlet-text MCP server ready')
console.log('Methods: render, list_fonts, render_box')
console.log('Pricing: 1c per call | Powered by SettleGrid')
