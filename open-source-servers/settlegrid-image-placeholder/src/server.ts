/**
 * settlegrid-image-placeholder — Placeholder Image Generation MCP Server
 *
 * Generate placeholder image URLs for prototyping and design. No API key needed.
 *
 * Methods:
 *   get_placeholder(width, height, options?) — Generate placeholder URL (free)
 *   get_avatar(name, size?) — Generate avatar placeholder (free)
 *   get_pattern(width, height, pattern?) — Generate pattern URL (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlaceholderInput { width: number; height?: number; text?: string; bgColor?: string; textColor?: string }
interface AvatarInput { name: string; size?: number; rounded?: boolean }
interface PatternInput { width: number; height?: number; pattern?: string }

const sg = settlegrid.init({
  toolSlug: 'image-placeholder',
  pricing: {
    defaultCostCents: 0,
    methods: {
      get_placeholder: { costCents: 0, displayName: 'Placeholder Image' },
      get_avatar: { costCents: 0, displayName: 'Avatar Placeholder' },
      get_pattern: { costCents: 0, displayName: 'Pattern Image' },
    },
  },
})

const getPlaceholder = sg.wrap(async (args: PlaceholderInput) => {
  const w = Math.min(Math.max(args.width || 300, 1), 4000)
  const h = Math.min(Math.max(args.height || w, 1), 4000)
  const bg = (args.bgColor || 'cccccc').replace('#', '')
  const fg = (args.textColor || '333333').replace('#', '')
  const text = args.text || `${w}x${h}`
  return {
    url: `https://placehold.co/${w}x${h}/${bg}/${fg}?text=${encodeURIComponent(text)}`,
    urlPng: `https://placehold.co/${w}x${h}/${bg}/${fg}.png?text=${encodeURIComponent(text)}`,
    urlSvg: `https://placehold.co/${w}x${h}/${bg}/${fg}.svg?text=${encodeURIComponent(text)}`,
    dummyImage: `https://dummyimage.com/${w}x${h}/${bg}/${fg}&text=${encodeURIComponent(text)}`,
    dimensions: { width: w, height: h },
  }
}, { method: 'get_placeholder' })

const getAvatar = sg.wrap(async (args: AvatarInput) => {
  const name = args.name?.trim() || 'User'
  const size = Math.min(Math.max(args.size || 128, 16), 512)
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return {
    dicebear: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&size=${size}`,
    uiAvatars: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&rounded=${args.rounded !== false}`,
    boringAvatars: `https://source.boringavatars.com/beam/${size}/${encodeURIComponent(name)}`,
    initials,
    size,
  }
}, { method: 'get_avatar' })

const getPattern = sg.wrap(async (args: PatternInput) => {
  const w = Math.min(Math.max(args.width || 400, 1), 4000)
  const h = Math.min(Math.max(args.height || w, 1), 4000)
  const pattern = args.pattern || 'random'
  const seed = Math.random().toString(36).slice(2, 10)
  return {
    heroPatterns: `https://heropatterns.com`,
    picsum: `https://picsum.photos/${w}/${h}?random=${seed}`,
    picsumBlur: `https://picsum.photos/${w}/${h}?blur=2&random=${seed}`,
    picsumGrayscale: `https://picsum.photos/${w}/${h}?grayscale&random=${seed}`,
    dimensions: { width: w, height: h },
    pattern,
  }
}, { method: 'get_pattern' })

export { getPlaceholder, getAvatar, getPattern }

console.log('settlegrid-image-placeholder MCP server ready')
console.log('Methods: get_placeholder, get_avatar, get_pattern')
console.log('Pricing: Free | Powered by SettleGrid')
