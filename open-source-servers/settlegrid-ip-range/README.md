# settlegrid-ip-range

IP Range / CIDR Calculator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Calculate IP ranges, subnets, and CIDR notation. All local, no API needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_cidr(cidr)` | Parse CIDR and show range details | Free |
| `ip_in_range(ip, cidr)` | Check if IP is in CIDR range | Free |
| `subnet_info(ip, mask)` | Get subnet information | Free |
| `ip_to_int(ip)` | Convert IP to integer | Free |
| `int_to_ip(int)` | Convert integer to IP | Free |

## Parameters

### parse_cidr
- `cidr` (string, required) — CIDR notation (e.g., 192.168.1.0/24)

### ip_in_range
- `ip` (string, required) — IP address to check
- `cidr` (string, required) — CIDR range

### subnet_info
- `ip` (string, required) — IP address
- `mask` (number, required) — Subnet mask prefix length (0-32)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-ip-range .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ip-range
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
