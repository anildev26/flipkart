import { Router, Request, Response } from 'express'
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
  writeFileSync(
    path,
    [
      '# Netscape HTTP Cookie File',
      `.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t${sessionId.trim()}`,
    ].join('\n'),
    'utf-8'
  )
  return path
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
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
      const videoUrl = entry.url ?? entry.formats?.slice(-1)[0]?.url
      if (!videoUrl) continue
      stories.push({
        id: entry.id ?? randomBytes(4).toString('hex'),
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
    if (/login|cookie|auth|session/i.test(msg)) {
      error = 'Session ID is invalid or expired. Please get a fresh one from your browser.'
    } else if (/private/i.test(msg)) {
      error = 'This account is private.'
    } else if (/not found|404/i.test(msg)) {
      error = 'Account not found. Check the username.'
    }
    return res.status(500).json({ error })
  } finally {
    try { unlinkSync(cookiePath) } catch {}
  }
})

export default router
