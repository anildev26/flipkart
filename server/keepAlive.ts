import cron from 'node-cron'
import axios from 'axios'

// Render free tier sleeps after 15 min of inactivity.
// This pings our own /health endpoint every 10 min to stay warm.
export function startKeepAlive() {
  const selfUrl = process.env.RENDER_EXTERNAL_URL
  if (!selfUrl) {
    console.log('[keep-alive] RENDER_EXTERNAL_URL not set — skipping (local dev)')
    return
  }

  console.log(`[keep-alive] Will ping ${selfUrl}/health every 10 min`)

  cron.schedule('*/10 * * * *', async () => {
    try {
      await axios.get(`${selfUrl}/health`, { timeout: 8_000 })
      console.log(`[keep-alive] ${new Date().toISOString()} — ok`)
    } catch (err: any) {
      console.warn(`[keep-alive] ping failed: ${err.message}`)
    }
  })
}
