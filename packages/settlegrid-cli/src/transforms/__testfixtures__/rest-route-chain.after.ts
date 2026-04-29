import express from 'express'

import { settlegrid } from '@settlegrid/mcp';

const app = express()

const sg = settlegrid.init({
  toolSlug: 'rest-route-chain',

  pricing: {
    defaultCostCents: 1
  }
});

app
  .route('/users')
  .get(sg.wrap(async (req, res) => {
    res.json({ users: [] })
  }, {
  method: 'get:/users'
}))
  .post(sg.wrap(async (req, res) => {
    res.status(201).json({ created: true })
  }, {
  method: 'post:/users'
}))

app.route('/items').get(sg.wrap(async (req, res) => {
  res.json({ items: [] })
}, {
  method: 'get:/items'
}))

app.listen(3000)
