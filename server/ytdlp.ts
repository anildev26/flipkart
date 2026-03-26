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
  {
    label: 'tv_embedded (no cookies)',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb'],
  },
  ...(cookiesFile ? [{
    label: 'tv_embedded + cookies',
    args: [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb', '--cookies', cookiesFile],
  }] : []),
  ...(cookiesFile ? [{
    label: 'web + cookies (full access)',
    args: [...BASE, '--extractor-args', 'youtube:player_client=web,android', '--cookies', cookiesFile],
  }] : []),
]

// Per-attempt timeout — kills yt-dlp if it hangs so next attempt can run
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
  const infoArgs = ['--dump-single-json', '--format', 'bestvideo+bestaudio/best', '--socket-timeout', '15', url]
  let lastErr: Error = new Error('All attempts failed')

  for (const attempt of ATTEMPTS) {
    try {
      console.log(`[yt-dlp] Trying: ${attempt.label}`)
      const out = await runYtdlp([...attempt.args, ...infoArgs])
      console.log(`[yt-dlp] SUCCESS via: ${attempt.label}`)
      const usedCookies = attempt.label.includes('cookies')
      return { data: JSON.parse(out), usedCookies, method: attempt.label }
    } catch (err: any) {
      console.warn(`[yt-dlp] FAILED (${attempt.label}): ${err.message.slice(0, 150)}`)
      lastErr = err
      // always continue to next attempt
    }
  }

  throw lastErr
}

export function ytdlpStream(url: string, format: string, useCookies = false) {
  const args = useCookies && cookiesFile
    ? [...BASE, '--extractor-args', 'youtube:player_client=web,android', '--cookies', cookiesFile]
    : [...BASE, '--extractor-args', 'youtube:player_client=tv_embedded,android_vr,mweb']

  console.log(`[yt-dlp] stream (${useCookies ? 'web+cookies' : 'tv_embedded'}) → ${url}`)
  return spawn(YTDLP, [...args, '-f', format, '-o', '-', url])
}
