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
  console.log('[yt-dlp] YouTube cookies loaded from env')
} else {
  console.warn('[yt-dlp] YOUTUBE_COOKIES not set — YouTube bot detection may block requests')
}

const BASE_ARGS = [
  '--no-warnings',
  '--no-playlist',
  // tv_embedded = YouTube's embedded player client, no bot/sign-in check
  // android_vr is fallback — both bypass bot detection without cookies
  '--extractor-args', 'youtube:player_client=tv_embedded,android_vr',
  '--add-header', 'User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  '--no-check-certificates',
  ...(cookiesFile ? ['--cookies', cookiesFile] : []),
  ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
]

export function ytdlpInfo(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [...BASE_ARGS, '--dump-single-json', '--socket-timeout', '15', url]
    let stdout = ''
    let stderr = ''
    const proc = spawn(YTDLP, args)
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => reject(new Error(`yt-dlp binary not found at ${YTDLP}: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)) }
        catch { reject(new Error('Failed to parse yt-dlp output')) }
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
      }
    })
  })
}

export function ytdlpStream(url: string, format: string) {
  const args = [...BASE_ARGS, '-f', format, '-o', '-', url]
  return spawn(YTDLP, args)
}
