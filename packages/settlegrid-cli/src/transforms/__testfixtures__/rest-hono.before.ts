import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/items', async (c) => {
  return c.json({ items: [] })
})

app.post('/items', async (c) => {
  return c.json({ created: true }, 201)
})

serve({ fetch: app.fetch, port: 3000 })
