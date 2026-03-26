import type { NextApiRequest, NextApiResponse } from 'next'
import youtubeDl from 'youtube-dl-exec'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'

export type Story = {
  id: string
  thumbnail: string
  videoUrl: string
  timestamp?: number
  isVideo: boolean
}

function buildCookieFile(sessionId: string): string {
  const path = join(tmpdir(), `ig_${randomBytes(8).toString('hex')}.txt`)
  const content = [
    '# Netscape HTTP Cookie File',
    `# Generated for yt-dlp`,
    `.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t${sessionId.trim()}`,
  ].join('\n')
  writeFileSync(path, content, 'utf-8')
  return path
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, sessionId } = req.body
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Instagram username is required' })
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Instagram session ID is required' })
  }

  const cookiePath = buildCookieFile(sessionId)

  try {
    const storiesUrl = `https://www.instagram.com/stories/${username.replace('@', '')}/`

    const info = await youtubeDl(storiesUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      cookies: cookiePath,
    }) as any

    const stories: Story[] = []

    const entries: any[] = info.entries ?? (info.url ? [info] : [])

    for (const entry of entries) {
      const videoUrl = entry.url
        ?? entry.formats?.slice(-1)[0]?.url

      if (!videoUrl) continue

      stories.push({
        id: entry.id ?? String(Math.random()),
        thumbnail: entry.thumbnail ?? '',
        videoUrl,
        timestamp: entry.timestamp,
        isVideo: (entry.ext ?? 'mp4') !== 'jpg',
      })
    }

    return res.json({ stories, username: username.replace('@', '') })
  } catch (err: any) {
    const msg: string = err?.stderr || err?.message || ''
    let error = 'Failed to fetch stories. Check the username and try again.'
    if (msg.includes('login') || msg.includes('cookie') || msg.includes('auth')) {
      error = 'Session ID is invalid or expired. Please get a fresh one from your browser.'
    } else if (msg.includes('Private') || msg.includes('private')) {
      error = 'This account is private.'
    } else if (msg.includes('not found') || msg.includes('404')) {
      error = 'Account not found. Check the username.'
    } else if (msg.includes('No stories') || msg.includes('no stories')) {
      error = 'No active stories found for this account.'
    }
    return res.status(500).json({ error })
  } finally {
    try { unlinkSync(cookiePath) } catch {}
  }
}
