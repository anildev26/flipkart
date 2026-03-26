import { Router, Request, Response } from 'express'
import { ytdlpInfo } from '../ytdlp'

export type VideoFormat = { label: string; quality: string }
export type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  platform: string
  qualities: VideoFormat[]
}

const STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360]

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X'
  return 'Unknown'
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    const info = await Promise.race([
      ytdlpInfo(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 50_000)
      ),
    ])

    const availableHeights = new Set<number>()
    for (const f of (info.formats as any[]) || []) {
      if (f.height && f.vcodec && f.vcodec !== 'none') {
        availableHeights.add(f.height)
      }
    }

    const qualities: VideoFormat[] = STANDARD_HEIGHTS
      .filter(h => [...availableHeights].some(fh => fh >= h))
      .map(h => ({ label: `${h}p`, quality: `${h}p` }))

    if (qualities.length === 0) {
      qualities.push({ label: 'Best', quality: 'best' })
    }

    return res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration ?? 0,
      platform: detectPlatform(url),
      qualities,
    } satisfies VideoInfo)
  } catch (err: any) {
    const msg: string = err?.message || ''
    console.error('[info] error:', msg.slice(0, 300))
    if (/video is private/i.test(msg)) {
      return res.status(500).json({ error: 'This video is private.' })
    }
    return res.status(500).json({ error: 'Could not fetch video info. ' + msg.slice(0, 120) })
  }
})

export default router
