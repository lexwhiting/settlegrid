import express from 'express'

import { settlegrid } from '@settlegrid/mcp';

const app = express()

const sg = settlegrid.init({
  toolSlug: 'rest-express',

  pricing: {
    defaultCostCents: 1
  }
});

app.get('/users/:id', sg.wrap(async (req, res) => {
  res.json({ id: req.params.id })
}, {
  method: 'get:/users/:id'
}))

app.post('/users', sg.wrap(async (req, res) => {
  res.status(201).json({ created: true })
}, {
  method: 'post:/users'
}))

app.listen(3000)
