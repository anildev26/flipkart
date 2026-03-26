import { Router, Request, Response } from 'express'
import axios from 'axios'
import { ytdlpInfo } from '../ytdlp'

export type VideoFormat = { label: string; quality: string }
export type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  platform: string
  qualities: VideoFormat[]
  usedCookies: boolean
  method: string
}

const STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360]

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X'
  return 'Unknown'
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// Fast YouTube metadata via oEmbed — no yt-dlp, no auth, never blocked
async function youtubeOembed(url: string) {
  const res = await axios.get('https://www.youtube.com/oembed', {
    params: { url, format: 'json' },
    timeout: 8000,
  })
  return res.data
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }

  const platform = detectPlatform(url)

  // For YouTube: use oEmbed for fast metadata, skip yt-dlp dump entirely
  if (platform === 'YouTube') {
    const videoId = extractYoutubeId(url)
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

    try {
      const oembed = await youtubeOembed(url)
      return res.json({
        title: oembed.title,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        platform: 'YouTube',
        // Offer all standard qualities — yt-dlp will pick best available on download
        qualities: STANDARD_HEIGHTS.map(h => ({ label: `${h}p`, quality: `${h}p` })),
        usedCookies: false,
        method: 'YouTube oEmbed',
      } satisfies VideoInfo)
    } catch (err: any) {
      return res.status(500).json({ error: 'Could not fetch YouTube video. It may be private or unavailable.' })
    }
  }

  // For Instagram / Facebook / others: use yt-dlp
  try {
    const { data: info, usedCookies, method } = await Promise.race([
      ytdlpInfo(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 90_000)
      ),
    ])

    const availableHeights = new Set<number>()
    for (const f of (info.formats as any[]) || []) {
      if (f.height && f.vcodec && f.vcodec !== 'none') availableHeights.add(f.height)
    }

    const qualities: VideoFormat[] = STANDARD_HEIGHTS
      .filter(h => [...availableHeights].some(fh => fh >= h))
      .map(h => ({ label: `${h}p`, quality: `${h}p` }))

    if (qualities.length === 0) qualities.push({ label: 'Best', quality: 'best' })

    return res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration ?? 0,
      platform,
      qualities,
      usedCookies,
      method,
    } satisfies VideoInfo)
  } catch (err: any) {
    const msg: string = err?.message || ''
    console.error('[info] error:', msg.slice(0, 300))
    return res.status(500).json({ error: 'Could not fetch video. ' + msg.slice(0, 150) })
  }
})

export default router
