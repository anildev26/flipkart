import express from 'express'
import cors from 'cors'
import infoRouter from './routes/info'
import storiesRouter from './routes/stories'
import proxyRouter from './routes/proxy'
import { startKeepAlive } from './keepAlive'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// Health check — used by keep-alive cron
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

app.use('/api/info', infoRouter)
app.use('/api/stories', storiesRouter)
app.use('/api/proxy', proxyRouter)

app.listen(PORT, () => {
  console.log(`VidSnap backend running on port ${PORT}`)
  startKeepAlive()
})
