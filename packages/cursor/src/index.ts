/**
 * @settlegrid/cursor — public API (P2.FMT3).
 *
 * Two surfaces in this package:
 *
 *   1. **Developer adapter** (this file): `wrapCursorTool` — the
 *      sg.wrap-based billing wrapper for MCP tool handlers running
 *      inside Cursor. The same pattern as @settlegrid/ai-sdk and
 *      @settlegrid/mastra.
 *
 *   2. **Standalone MCP server** (`cli.ts`): the stdio-transport MCP
 *      plugin that Cursor users can configure to browse + invoke
 *      SettleGrid marketplace tools. Runs via the `settlegrid-cursor`
 *      bin. See cli.ts for the server implementation.
 *
 * Library consumers (tool authors) import from this entry:
 *   import { wrapCursorTool } from '@settlegrid/cursor'
 *
 * CLI users install globally and run:
 *   npm install -g @settlegrid/cursor && settlegrid-cursor
 */

export { wrapCursorTool } from './wrap'
export type {
  WrapCursorToolOptions,
  CursorToolExtra,
  CursorToolHandler,
} from './wrap'
