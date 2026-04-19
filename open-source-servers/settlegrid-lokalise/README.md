# settlegrid-lokalise

Lokalise MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lokalise)

Manage localization projects, keys, and translations via the Lokalise API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_project(name: string, team_id: number, base_lang_iso: string, description?: string)` | Create a new localization project | 3¢ |
| `list_projects(limit?: number, page?: number)` | List all localization projects | 1¢ |
| `get_project(project_id: string)` | Retrieve details for a specific project | 1¢ |
| `list_keys(project_id: string, limit?: number, page?: number, filter_tags?: string)` | List translation keys in a project | 1¢ |
| `create_key(project_id: string, key_name: string, platforms: string[], description?: string)` | Create a new translation key in a project | 3¢ |
| `list_languages(project_id: string)` | List languages configured for a project | 1¢ |
| `list_translations(project_id: string, language_iso?: string, limit?: number, page?: number)` | List translations for a project with optional language filter | 1¢ |
| `update_translation(project_id: string, translation_id: number, translation: string, is_reviewed?: boolean)` | Update a specific translation value | 3¢ |

## Parameters

### create_project
- `name` (string, required) — Name of the new project
- `team_id` (number, required) — Numeric ID of the team to create the project in
- `base_lang_iso` (string, required) — ISO 639-1 code of the project base language (e.g. en, fr)
- `description` (string) — Optional project description

### list_projects
- `limit` (number) — Number of projects to return (default 100, max 500)
- `page` (number) — Page number for pagination (default 1)

### get_project
- `project_id` (string, required) — Unique identifier of the Lokalise project

### list_keys
- `project_id` (string, required) — Unique identifier of the Lokalise project
- `limit` (number) — Number of keys to return (default 100, max 500)
- `page` (number) — Page number for pagination (default 1)
- `filter_tags` (string) — Comma-separated list of tags to filter keys by

### create_key
- `project_id` (string, required) — Unique identifier of the Lokalise project
- `key_name` (string, required) — The key name string (e.g. welcome_message)
- `platforms` (string[], required) — Platforms this key applies to (e.g. ["web", "ios", "android"])
- `description` (string) — Optional description or context for translators

### list_languages
- `project_id` (string, required) — Unique identifier of the Lokalise project

### list_translations
- `project_id` (string, required) — Unique identifier of the Lokalise project
- `language_iso` (string) — Filter translations by ISO 639-1 language code (e.g. fr, de)
- `limit` (number) — Number of translations to return (default 100, max 500)
- `page` (number) — Page number for pagination (default 1)

### update_translation
- `project_id` (string, required) — Unique identifier of the Lokalise project
- `translation_id` (number, required) — Numeric ID of the translation to update
- `translation` (string, required) — The new translated string value
- `is_reviewed` (boolean) — Mark the translation as reviewed (default false)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LOKALISE_API_KEY` | Yes | Lokalise API key from [https://app.lokalise.com/profile#access-tokens](https://app.lokalise.com/profile#access-tokens) |

## Upstream API

- **Provider**: Lokalise
- **Base URL**: https://api.lokalise.com/api2
- **Auth**: API key required
- **Docs**: https://developers.lokalise.com/reference/lokalise-rest-api

## Deploy

### Docker

```bash
docker build -t settlegrid-lokalise .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lokalise
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
