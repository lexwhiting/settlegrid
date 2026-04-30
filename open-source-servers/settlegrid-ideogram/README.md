# settlegrid-ideogram

Ideogram MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ideogram)

Generate, edit, remix, and reframe images using the Ideogram 3.0 AI image generation API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_image(prompt: string, aspect_ratio?: string, style_type?: string, style_preset?: string, negative_prompt?: string, num_images?: number, rendering_speed?: string, seed?: number)` | Generate an image from a text prompt using Ideogram 3.0 | 8¢ |
| `generate_transparent_image(prompt: string, aspect_ratio?: string, negative_prompt?: string, num_images?: number, rendering_speed?: string, upscale_factor?: number, seed?: number)` | Generate an image with a transparent background using Ideogram 3.0 | 8¢ |
| `edit_image(image_url: string, mask_url: string, prompt: string, style_type?: string, style_preset?: string, num_images?: number, rendering_speed?: string, seed?: number)` | Edit a region of an image using a mask and text prompt with Ideogram 3.0 | 8¢ |
| `remix_image(image_url: string, prompt: string, image_weight?: number, aspect_ratio?: string, style_type?: string, style_preset?: string, negative_prompt?: string, num_images?: number, rendering_speed?: string, seed?: number)` | Remix an existing image with a text prompt using Ideogram 3.0 | 8¢ |

## Parameters

### generate_image
- `prompt` (string, required) — Text prompt describing the image to generate
- `aspect_ratio` (string) — Aspect ratio of the generated image (e.g. ASPECT_1_1, ASPECT_16_9)
- `style_type` (string) — Style type for the image (e.g. REALISTIC, DESIGN, ANIME)
- `style_preset` (string) — Style preset name
- `negative_prompt` (string) — Description of what to exclude from the image
- `num_images` (number) — Number of images to generate (default 1, max 4)
- `rendering_speed` (string) — Rendering speed: TURBO, DEFAULT, or QUALITY
- `seed` (number) — Random seed for reproducible generation

### generate_transparent_image
- `prompt` (string, required) — Text prompt describing the image to generate
- `aspect_ratio` (string) — Aspect ratio of the generated image (e.g. ASPECT_1_1, ASPECT_16_9)
- `negative_prompt` (string) — Description of what to exclude from the image
- `num_images` (number) — Number of images to generate (default 1, max 4)
- `rendering_speed` (string) — Rendering speed: TURBO, DEFAULT, or QUALITY
- `upscale_factor` (number) — Optional upscale factor applied after generation
- `seed` (number) — Random seed for reproducible generation

### edit_image
- `image_url` (string, required) — Public URL of the image to edit (JPEG/PNG/WebP, max 10MB)
- `mask_url` (string, required) — Public URL of the black-and-white mask image (same size as image, JPEG/PNG/WebP, max 10MB)
- `prompt` (string, required) — Text prompt describing the desired edited result
- `style_type` (string) — Style type for the edit (e.g. REALISTIC, DESIGN, ANIME)
- `style_preset` (string) — Style preset name
- `num_images` (number) — Number of edited images to generate (default 1, max 4)
- `rendering_speed` (string) — Rendering speed: TURBO, DEFAULT, or QUALITY
- `seed` (number) — Random seed for reproducible generation

### remix_image
- `image_url` (string, required) — Public URL of the image to remix (JPEG/PNG/WebP, max 10MB)
- `prompt` (string, required) — Text prompt guiding the remix
- `image_weight` (number) — Weight of the input image (0-100, default 50)
- `aspect_ratio` (string) — Aspect ratio of the remixed image (e.g. ASPECT_1_1, ASPECT_16_9)
- `style_type` (string) — Style type for the remix (e.g. REALISTIC, DESIGN, ANIME)
- `style_preset` (string) — Style preset name
- `negative_prompt` (string) — Description of what to exclude from the image
- `num_images` (number) — Number of images to generate (default 1, max 4)
- `rendering_speed` (string) — Rendering speed: TURBO, DEFAULT, or QUALITY
- `seed` (number) — Random seed for reproducible generation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IDEOGRAM_API_KEY` | Yes | Ideogram API key from [https://ideogram.ai/manage-api](https://ideogram.ai/manage-api) |

## Upstream API

- **Provider**: Ideogram
- **Base URL**: https://api.ideogram.ai
- **Auth**: API key required
- **Docs**: https://developer.ideogram.ai/api-reference

## Deploy

### Docker

```bash
docker build -t settlegrid-ideogram .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ideogram
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
