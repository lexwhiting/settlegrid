export { SettleGrid } from './nodes/SettleGrid/SettleGrid.node';
export { SettleGridApi } from './credentials/SettleGridApi.credentials';

// P2.FMT3 — developer-side billing adapter (wrap a node operation's
// execute logic with sg.wrap). See wrap.ts for the full API.
export { wrapN8nTool } from './wrap';
export type {
  WrapN8nToolOptions,
  N8nBillingContext,
  N8nWrappedExecute,
} from './wrap';
