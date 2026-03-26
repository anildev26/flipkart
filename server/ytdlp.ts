import { spawn } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'

const YTDLP =
  process.env.YTDL_PATH ||
  path.join(__dirname, '../bin/yt-dlp')

// Write YOUTUBE_COOKIES env var to a temp file once on startup
let cookiesFile: string | null = null
if (process.env.YOUTUBE_COOKIES) {
  cookiesFile = join(tmpdir(), 'yt_cookies.txt')
  writeFileSync(cookiesFile, process.env.YOUTUBE_COOKIES, 'utf-8')
  console.log('[yt-dlp] YouTube cookies loaded from env — will use as fallback')
} else {
  console.log('[yt-dlp] No YOUTUBE_COOKIES set — will use tv_embedded client only')
}

const FFMPEG_ARGS = ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []

function buildArgs(extraArgs: string[]): string[] {
  return [
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--add-header', 'User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    ...FFMPEG_ARGS,
    ...extraArgs,
  ]
}

// Attempt 1: tv_embedded client (no cookies needed)
const ARGS_NO_COOKIES = buildArgs([
  '--extractor-args', 'youtube:player_client=tv_embedded,android_vr',
])

// Attempt 2: cookies (fallback if bot detection still fires)
const ARGS_WITH_COOKIES = cookiesFile
  ? buildArgs([
      '--extractor-args', 'youtube:player_client=tv_embedded,android_vr',
      '--cookies', cookiesFile,
    ])
  : null

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

const BOT_DETECTED = /sign in|bot|confirm your age|login required/i

export async function ytdlpInfo(url: string): Promise<{ data: any; usedCookies: boolean }> {
  const infoArgs = ['--dump-single-json', '--socket-timeout', '15', url]

  // Attempt 1 — tv_embedded, no cookies
  try {
    console.log(`[yt-dlp] Attempt 1: tv_embedded (no cookies) → ${url}`)
    const out = await runYtdlp([...ARGS_NO_COOKIES, ...infoArgs])
    console.log('[yt-dlp] Attempt 1 SUCCESS')
    return { data: JSON.parse(out), usedCookies: false }
  } catch (err: any) {
    console.warn('[yt-dlp] Attempt 1 failed:', err.message.slice(0, 120))
    if (!BOT_DETECTED.test(err.message) || !ARGS_WITH_COOKIES) throw err
  }

  // Attempt 2 — cookies fallback
  console.log('[yt-dlp] Attempt 2: tv_embedded + cookies fallback')
  try {
    const out = await runYtdlp([...ARGS_WITH_COOKIES!, ...infoArgs])
    console.log('[yt-dlp] Attempt 2 SUCCESS (cookies worked)')
    return { data: JSON.parse(out), usedCookies: true }
  } catch (err: any) {
    console.error('[yt-dlp] Attempt 2 failed:', err.message.slice(0, 120))
    throw err
  }
}

export function ytdlpStream(url: string, format: string, useCookies = false) {
  const base = (useCookies && ARGS_WITH_COOKIES) ? ARGS_WITH_COOKIES : ARGS_NO_COOKIES
  const args = [...base, '-f', format, '-o', '-', url]
  console.log(`[yt-dlp] stream: ${useCookies ? 'with cookies' : 'no cookies'} → ${url}`)
  return spawn(YTDLP, args)
}
