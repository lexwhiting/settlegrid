/**
 * settlegrid-color-blindness — Color Blindness Simulation MCP Server
 *
 * Simulates how colors appear under different types of color vision
 * deficiency. Implements Brettel/Vienot transformation matrices.
 *
 * Methods:
 *   simulate(hex, type)           — Simulate color appearance        (1c)
 *   check_palette(colors)         — Check palette accessibility      (1c)
 *   get_safe_palette(count)       — Get colorblind-safe palette      (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface SimulateInput {
  hex: string
  type?: string
}

interface CheckPaletteInput {
  colors: string[]
}

interface GetSafePaletteInput {
  count?: number
}

// --- Helpers ----------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}

function linearize(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function delinearize(v: number): number {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(s * 255)
}

// Simplified Brettel/Vienot simulation matrices
const MATRICES: Record<string, number[][]> = {
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
  achromatopsia: [[0.299, 0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]],
}

function simulateColor(hex: string, type: string): string {
  const [r, g, b] = hexToRgb(hex)
  const lin = [linearize(r), linearize(g), linearize(b)]
  const matrix = MATRICES[type]
  if (!matrix) return hex

  const result = matrix.map(row => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])
  return rgbToHex(delinearize(result[0]), delinearize(result[1]), delinearize(result[2]))
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2))
}

const SAFE_PALETTES = [
  ['#000000', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'],
  ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#882255'],
]

const CVD_TYPES: Record<string, { name: string; prevalence: string; description: string }> = {
  protanopia: { name: 'Protanopia', prevalence: '1% of males', description: 'Red-blind: no red cones, red appears dark' },
  deuteranopia: { name: 'Deuteranopia', prevalence: '1% of males', description: 'Green-blind: no green cones, green/red confusion' },
  tritanopia: { name: 'Tritanopia', prevalence: '0.003% of population', description: 'Blue-blind: no blue cones, blue/yellow confusion' },
  achromatopsia: { name: 'Achromatopsia', prevalence: '0.003% of population', description: 'Total color blindness: sees only grayscale' },
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'color-blindness',
  pricing: {
    defaultCostCents: 1,
    methods: {
      simulate: { costCents: 1, displayName: 'Simulate Color Vision' },
      check_palette: { costCents: 1, displayName: 'Check Palette' },
      get_safe_palette: { costCents: 1, displayName: 'Get Safe Palette' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const simulate = sg.wrap(async (args: SimulateInput) => {
  if (!args.hex) throw new Error('hex color required (e.g. "#FF5733")')
  const type = (args.type ?? 'deuteranopia').toLowerCase()
  if (!MATRICES[type]) throw new Error(`Unknown type. Available: ${Object.keys(MATRICES).join(', ')}`)

  const simulated = simulateColor(args.hex, type)
  const info = CVD_TYPES[type]

  return {
    original: args.hex,
    simulated,
    type,
    type_name: info?.name ?? type,
    prevalence: info?.prevalence ?? 'unknown',
    description: info?.description ?? '',
    color_shift: Math.round(colorDistance(args.hex, simulated)),
  }
}, { method: 'simulate' })

const checkPalette = sg.wrap(async (args: CheckPaletteInput) => {
  if (!args.colors?.length) throw new Error('colors array required')

  const results = Object.keys(MATRICES).map(type => {
    const simulated = args.colors.map(c => simulateColor(c, type))
    let minDist = Infinity
    for (let i = 0; i < simulated.length; i++) {
      for (let j = i + 1; j < simulated.length; j++) {
        minDist = Math.min(minDist, colorDistance(simulated[i], simulated[j]))
      }
    }
    return {
      type,
      min_distance: Math.round(minDist),
      distinguishable: minDist > 30,
      simulated_colors: simulated,
    }
  })

  const allPass = results.every(r => r.distinguishable)

  return {
    colors: args.colors,
    accessible: allPass,
    results,
    recommendation: allPass ? 'Palette is accessible' : 'Some colors may be indistinguishable — consider using the safe palette',
  }
}, { method: 'check_palette' })

const getSafePalette = sg.wrap(async (args: GetSafePaletteInput) => {
  const count = Math.min(Math.max(args.count ?? 8, 2), 8)
  const palette = SAFE_PALETTES[0].slice(0, count)
  return {
    colors: palette,
    count: palette.length,
    source: 'Wong (2011) colorblind-safe palette',
    note: 'Distinguishable under all common forms of color vision deficiency',
  }
}, { method: 'get_safe_palette' })

// --- Exports ----------------------------------------------------------------

export { simulate, checkPalette, getSafePalette }

console.log('settlegrid-color-blindness MCP server ready')
console.log('Methods: simulate, check_palette, get_safe_palette')
console.log('Pricing: 1c per call | Powered by SettleGrid')
