import { Router, Request, Response } from 'express'
import youtubeDl from 'youtube-dl-exec'

export type VideoFormat = {
  label: string
  quality: string
}

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
    // Race yt-dlp against a 45s timeout
    const info = await Promise.race([
      youtubeDl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noPlaylist: true,
        socketTimeout: '15',
      }) as Promise<any>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 45_000)
      ),
    ])

    // Collect available heights from all video formats
    const availableHeights = new Set<number>()
    for (const f of (info.formats as any[]) || []) {
      if (f.height && f.vcodec && f.vcodec !== 'none') {
        availableHeights.add(f.height)
      }
    }

    // Map to standard quality labels (only include qualities the video actually has)
    const qualities: VideoFormat[] = STANDARD_HEIGHTS
      .filter(h => [...availableHeights].some(fh => fh >= h))
      .map(h => ({ label: `${h}p`, quality: `${h}p` }))

    // Fallback if no formats found
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
    const msg: string = err?.stderr || err?.message || ''
    if (/private|login|sign in/i.test(msg)) {
      return res.status(500).json({ error: 'This video is private or requires login.' })
    }
    return res.status(500).json({ error: err.message || 'Could not fetch video info.' })
  }
})

export default router
