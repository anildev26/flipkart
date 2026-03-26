import { Router, Request, Response } from 'express'
import { ytdlpStream } from '../ytdlp'

const FORMAT_MAP: Record<string, string> = {
  '2160p': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best',
  '1440p': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best',
  '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best',
  '720p':  'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
  '480p':  'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best',
  '360p':  'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best',
  'best':  'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
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
