import { Hono } from 'hono'
import { serve } from '@hono/node-server'

import { settlegrid } from '@settlegrid/mcp';

const app = new Hono()

const sg = settlegrid.init({
  toolSlug: 'rest-hono',

  pricing: {
    defaultCostCents: 1
  }
});

app.get('/items', sg.wrap(async (c) => {
  return c.json({ items: [] })
}, {
  method: 'get:/items'
}))

app.post('/items', sg.wrap(async (c) => {
  return c.json({ created: true }, 201)
}, {
  method: 'post:/items'
}))

serve({ fetch: app.fetch, port: 3000 })
