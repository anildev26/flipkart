import { Router, Request, Response } from 'express'
import youtubeDl from 'youtube-dl-exec'
import ffmpegPath from 'ffmpeg-static'

// yt-dlp format strings per quality label
// bestvideo+bestaudio = yt-dlp merges them via ffmpeg into a single mp4
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

// GET /api/download?url=...&quality=720p&filename=video.mp4
// Streams yt-dlp output (with ffmpeg merge) directly to the browser.
// Browser shows its native download progress bar.
router.get('/', (req: Request, res: Response) => {
  const { url, quality = 'best', filename = 'video.mp4' } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url param is required' })
  }

  const format = FORMAT_MAP[quality as string] ?? FORMAT_MAP['best']

  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  // .raw() returns a ChildProcess — stdout is the video stream
  const proc = (youtubeDl as any).raw(url, {
    format,
    output: '-',          // pipe output to stdout
    noWarnings: true,
    noPlaylist: true,
    ...(ffmpegPath ? { ffmpegLocation: ffmpegPath } : {}),
  })

  proc.stdout?.pipe(res)

  proc.stderr?.on('data', (chunk: Buffer) => {
    // Log progress lines from yt-dlp for server-side visibility
    const line = chunk.toString().trim()
    if (line) console.log('[yt-dlp]', line.slice(0, 120))
  })

  proc.on('error', (err: Error) => {
    console.error('[download] error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed. Try again.' })
    }
  })

  // Kill yt-dlp if client disconnects early
  req.on('close', () => proc.kill?.())
})

export default router
