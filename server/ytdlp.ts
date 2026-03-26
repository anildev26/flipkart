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
  '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ...FFMPEG_ARGS,
]

// Attempts ordered: best first (most capable), fallback last
const ATTEMPTS: Array<{ label: string; args: string[] }> = [
  // 1. web + cookies — full access, handles everything
  ...(cookiesFile ? [{
    label: 'web + cookies',
    args: [...BASE, '--cookies', cookiesFile],
  }] : []),
  // 2. tv_embedded + cookies — lighter client with auth
  ...(cookiesFile ? [{
    label: 'tv_embedded + cookies',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded', '--cookies', cookiesFile],
  }] : []),
  // 3. tv_embedded no cookies — last resort, no auth needed
  {
    label: 'tv_embedded (no cookies)',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr'],
  },
]

function runYtdlp(args: string[], timeoutMs = 25_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const proc = spawn(YTDLP, args)

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`yt-dlp timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`yt-dlp not found at ${YTDLP}: ${err.message}`))
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
    })
  })
}

export async function ytdlpInfo(url: string): Promise<{ data: any; usedCookies: boolean; method: string }> {
  // No -f flag here — format validation causes "not available" errors on some videos
  const infoArgs = ['--dump-single-json', '--socket-timeout', '15', url]
  let lastErr: Error = new Error('All attempts failed')

  for (const attempt of ATTEMPTS) {
    try {
      console.log(`[yt-dlp] Trying: ${attempt.label}`)
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
  const args = useCookies && cookiesFile
    ? [...BASE, '--cookies', cookiesFile]
    : [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr']

  console.log(`[yt-dlp] stream (${useCookies ? 'web+cookies' : 'tv_embedded'}) → ${url}`)
  return spawn(YTDLP, [...args, '-f', format, '-o', '-', url])
}
