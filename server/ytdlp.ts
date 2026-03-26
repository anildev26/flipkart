import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'

const YTDLP =
  process.env.YTDL_PATH ||
  path.join(__dirname, '../bin/yt-dlp')

let cookiesFile: string | null = null
if (process.env.YOUTUBE_COOKIES) {
  cookiesFile = join(tmpdir(), 'yt_cookies.txt')
  writeFileSync(cookiesFile, process.env.YOUTUBE_COOKIES, 'utf-8')
  console.log('[yt-dlp] YouTube cookies loaded')
} else {
  console.log('[yt-dlp] No YOUTUBE_COOKIES set')
}

const FFMPEG_ARGS = ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []

const BASE = [
  '--no-warnings',
  '--no-playlist',
  '--no-check-certificates',
  '--add-header', 'User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  ...FFMPEG_ARGS,
]

const ATTEMPTS: Array<{ label: string; args: string[] }> = [
  // 1. tv_embedded — no bot check, works for most public videos
  {
    label: 'tv_embedded (no cookies)',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb'],
  },
  // 2. tv_embedded + cookies — for bot-gated videos
  ...(cookiesFile ? [{
    label: 'tv_embedded + cookies',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb', '--cookies', cookiesFile],
  }] : []),
  // 3. web + cookies — full access, handles embedding-disabled / age-restricted videos
  ...(cookiesFile ? [{
    label: 'web + cookies (full access)',
    args: [...BASE, '--extractor-args', 'youtube:player_client=web,android', '--cookies', cookiesFile],
  }] : []),
]

function runYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const proc = spawn(YTDLP, args)
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => reject(new Error(`yt-dlp not found at ${YTDLP}: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
    })
  })
}

// Retry on any yt-dlp error (bot, format unavailable, etc.) — stop only on success
export async function ytdlpInfo(url: string): Promise<{ data: any; usedCookies: boolean; method: string }> {
  const infoArgs = ['--dump-single-json', '--socket-timeout', '15', url]
  let lastErr: Error = new Error('All attempts failed')

  for (const attempt of ATTEMPTS) {
    try {
      console.log(`[yt-dlp] Trying: ${attempt.label} → ${url}`)
      const out = await runYtdlp([...attempt.args, ...infoArgs])
      console.log(`[yt-dlp] SUCCESS: ${attempt.label}`)
      const usedCookies = attempt.label.includes('cookies')
      return { data: JSON.parse(out), usedCookies, method: attempt.label }
    } catch (err: any) {
      console.warn(`[yt-dlp] FAILED (${attempt.label}): ${err.message.slice(0, 150)}`)
      lastErr = err
    }
  }

  throw lastErr
}

export function ytdlpStream(url: string, format: string, useCookies = false) {
  // Pick the most capable args that match what worked during info fetch
  const args = useCookies && cookiesFile
    ? [...BASE, '--extractor-args', 'youtube:player_client=web,android', '--cookies', cookiesFile]
    : [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb']

  console.log(`[yt-dlp] stream (${useCookies ? 'web+cookies' : 'tv_embedded'}) → ${url}`)
  return spawn(YTDLP, [...args, '-f', format, '-o', '-', url])
}
