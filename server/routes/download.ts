import { Router, Request, Response } from 'express'
import { ytdlpStream } from '../ytdlp'

const FORMAT_MAP: Record<string, string> = {
  '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]/best',
  '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]/best',
  '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
  '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
  '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
  '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]/best',
  'best':  'bestvideo+bestaudio/best',
}

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { url, quality = 'best', filename = 'video.mp4', cookies } = req.query
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url param is required' })
  }

  const format = FORMAT_MAP[quality as string] ?? FORMAT_MAP['best']
  const useCookies = cookies === '1'

  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  const proc = ytdlpStream(url, format, useCookies)

  proc.stdout.pipe(res)

  proc.stderr.on('data', (chunk: Buffer) => {
    const line = chunk.toString().trim()
    if (line) console.log('[yt-dlp]', line.slice(0, 120))
  })

  proc.on('error', (err: Error) => {
    console.error('[download] spawn error:', err.message)
    if (!res.headersSent) res.status(500).json({ error: 'Download failed.' })
  })

  req.on('close', () => proc.kill())
})

export default router
