# settlegrid-recraft

Recraft MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-recraft)

Generate, edit, vectorize, upscale, and manage AI-powered images and custom styles via the Recraft API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_image(prompt: string, style?: string, width?: number, height?: number, n?: number)` | Generate images from a text prompt | 8¢ |
| `edit_image(image_url: string, prompt: string, style?: string)` | Edit or modify an existing image with a prompt | 8¢ |
| `vectorize_image(image_url: string)` | Convert a raster image to a vector (SVG) | 5¢ |
| `remove_background(image_url: string)` | Remove the background from an image | 5¢ |
| `clarity_upscale(image_url: string)` | Upscale an image with clarity enhancement | 5¢ |
| `generative_upscale(image_url: string)` | Generatively upscale an image using AI | 8¢ |
| `list_styles()` | List all available styles | 1¢ |
| `delete_style(id: string)` | Delete a custom style by ID | 2¢ |

## Parameters

### generate_image
- `prompt` (string, required) — Text description of the image to generate
- `style` (string) — Style ID or preset name (e.g. 'realistic_image', 'digital_illustration')
- `width` (number) — Image width in pixels (default 1024)
- `height` (number) — Image height in pixels (default 1024)
- `n` (number) — Number of images to generate (default 1, max 6)

### edit_image
- `image_url` (string, required) — URL of the source image to edit
- `prompt` (string, required) — Text description of the desired edits
- `style` (string) — Style ID or preset name to apply during editing

### vectorize_image
- `image_url` (string, required) — URL of the raster image to vectorize

### remove_background
- `image_url` (string, required) — URL of the image to remove background from

### clarity_upscale
- `image_url` (string, required) — URL of the image to upscale with clarity enhancement

### generative_upscale
- `image_url` (string, required) — URL of the image to generatively upscale

### list_styles

### delete_style
- `id` (string, required) — The ID of the custom style to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RECRAFT_API_KEY` | Yes | Recraft API key from [https://www.recraft.ai/profile](https://www.recraft.ai/profile) |

## Upstream API

- **Provider**: Recraft
- **Base URL**: https://external.api.recraft.ai/v1
- **Auth**: API key required
- **Docs**: https://www.recraft.ai/docs/api-reference/endpoints

## Deploy

### Docker

```bash
docker build -t settlegrid-recraft .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-recraft
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
