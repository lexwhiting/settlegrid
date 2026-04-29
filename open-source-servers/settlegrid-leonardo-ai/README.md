# settlegrid-leonardo-ai

Leonardo.ai MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-leonardo-ai)

Generate AI images using Leonardo.ai's models with customizable prompts, styles, and generation parameters.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_generation(prompt: string, modelId?: string, width?: number, height?: number, num_images?: number, negative_prompt?: string, guidance_scale?: number, num_inference_steps?: number, presetStyle?: string, alchemy?: boolean, photoReal?: boolean, seed?: number)` | Generate images from a text prompt | 8¢ |
| `get_generation(generationId: string)` | Get generation details by ID | 1¢ |
| `delete_generation(generationId: string)` | Delete a generation by ID | 2¢ |
| `get_user_info()` | Get authenticated user info and token balance | 1¢ |
| `list_platform_models(limit?: number, offset?: number)` | List available Leonardo platform models | 1¢ |

## Parameters

### create_generation
- `prompt` (string, required) — The text prompt used to generate images
- `modelId` (string) — The Leonardo model ID to use for generation (e.g. 'aa77f04e-3eec-4034-9c07-d0f619684628')
- `width` (number) — Width of generated images in pixels (default 512, max 1536)
- `height` (number) — Height of generated images in pixels (default 512, max 1536)
- `num_images` (number) — Number of images to generate (default 1, max 4)
- `negative_prompt` (string) — Negative prompt to steer generation away from unwanted content
- `guidance_scale` (number) — How strongly the generation reflects the prompt (default 7, range 1-20)
- `num_inference_steps` (number) — Number of inference steps (default 30, max 60)
- `presetStyle` (string) — Style preset (e.g. CINEMATIC, CREATIVE, DYNAMIC, VIBRANT)
- `alchemy` (boolean) — Enable Alchemy mode for enhanced quality
- `photoReal` (boolean) — Enable PhotoReal mode for photorealistic output
- `seed` (number) — Random seed for reproducible generations

### get_generation
- `generationId` (string, required) — The UUID of the generation to retrieve

### delete_generation
- `generationId` (string, required) — The UUID of the generation to delete

### get_user_info

### list_platform_models
- `limit` (number) — Number of models to return (default 10, max 50)
- `offset` (number) — Pagination offset (default 0)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LEONARDO_API_KEY` | Yes | Leonardo.ai API key from [https://app.leonardo.ai/settings/api-keys](https://app.leonardo.ai/settings/api-keys) |

## Upstream API

- **Provider**: Leonardo.ai
- **Base URL**: https://cloud.leonardo.ai/api/rest/v1
- **Auth**: API key required
- **Docs**: https://docs.leonardo.ai/reference/creategeneration

## Deploy

### Docker

```bash
docker build -t settlegrid-leonardo-ai .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-leonardo-ai
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
