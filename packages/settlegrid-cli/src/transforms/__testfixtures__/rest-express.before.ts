import express from 'express'

const app = express()

app.get('/users/:id', async (req, res) => {
  res.json({ id: req.params.id })
})

app.post('/users', async (req, res) => {
  res.status(201).json({ created: true })
})

app.listen(3000)
