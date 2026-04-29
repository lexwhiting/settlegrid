import express from 'express'

const app = express()

app
  .route('/users')
  .get(async (req, res) => {
    res.json({ users: [] })
  })
  .post(async (req, res) => {
    res.status(201).json({ created: true })
  })

app.route('/items').get(async (req, res) => {
  res.json({ items: [] })
})

app.listen(3000)
