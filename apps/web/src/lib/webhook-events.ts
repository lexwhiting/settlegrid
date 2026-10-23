/**
 * Webhook event names developers can subscribe to — the single list shared by
 * the dashboard form, the webhooks API and the dispatcher (lib/webhooks.ts).
 * Only list events that are actually dispatched.
 */
export const WEBHOOK_EVENTS = [
  {
    name: 'tool.status_changed',
    label: 'Tool status changed',
    description: 'One of your tools was activated or moved back to draft.',
  },
] as const

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number]['name']

export const WEBHOOK_EVENT_NAMES = WEBHOOK_EVENTS.map((e) => e.name) as [
  WebhookEventName,
  ...WebhookEventName[],
]

/** Event name used by POST /api/developer/webhooks/[id]/test. */
export const WEBHOOK_TEST_EVENT = 'test.ping'

/** Normalise the stored `events` column (array, or a JSON-encoded array). */
export function parseWebhookEvents(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((e): e is string => typeof e === 'string')
  if (typeof raw === 'string') {
    try {
      return parseWebhookEvents(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}
