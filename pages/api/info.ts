import type { NextApiRequest, NextApiResponse } from 'next'
import youtubeDl from 'youtube-dl-exec'

export type VideoFormat = {
  label: string
  url: string
  ext: string
  filesize?: number
}

export type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  platform: string
  formats: VideoFormat[]
}

function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'Facebook'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X'
  return 'Unknown'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
    }) as any

    const formats: VideoFormat[] = []

    // Combined (audio+video) formats sorted best first
    const combined = ((info.formats as any[]) || [])
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0))

    const seenHeights = new Set<number>()
    for (const f of combined) {
      if (f.height && !seenHeights.has(f.height)) {
        seenHeights.add(f.height)
        formats.push({
          label: `${f.height}p`,
          url: f.url,
          ext: f.ext || 'mp4',
          filesize: f.filesize,
        })
      }
    }

    // YouTube / DASH-only: fall back to yt-dlp best merged URL
    if (formats.length === 0) {
      const bestUrl = await youtubeDl(url, {
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        getUrl: true,
        noWarnings: true,
        noPlaylist: true,
      }) as string | string[]

      const urlStr = Array.isArray(bestUrl) ? bestUrl[0] : bestUrl
      if (urlStr?.trim()) {
        formats.push({ label: 'Best Quality', url: urlStr.trim(), ext: 'mp4' })
      }
    }

    return res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      platform: detectPlatform(url),
      formats,
    } satisfies VideoInfo)
  } catch (err: any) {
    const msg: string = err?.stderr || err?.message || 'Failed to fetch video info'
    const isPrivate = msg.includes('Private') || msg.includes('login') || msg.includes('private')
    return res.status(500).json({
      error: isPrivate
        ? 'This video is private or requires login.'
        : 'Could not fetch video. Check the URL and try again.',
    })
  }
}
