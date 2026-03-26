import { spawn } from 'child_process'
import path from 'path'
import ffmpegPath from 'ffmpeg-static'

// Binary path: YTDL_PATH env (set on Render) → bundled in server/bin → system PATH
const YTDLP =
  process.env.YTDL_PATH ||
  path.join(__dirname, '../bin/yt-dlp')

const BASE_ARGS = [
  '--no-warnings',
  '--no-playlist',
  '--extractor-args', 'youtube:player_client=android,web',
  '--add-header', 'User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  ...(ffmpegPath ? ['--ffmpeg-location', ffmpegPath] : []),
]

/** Runs yt-dlp --dump-single-json and returns parsed JSON */
export function ytdlpInfo(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [...BASE_ARGS, '--dump-single-json', '--socket-timeout', '15', url]
    let stdout = ''
    let stderr = ''
    const proc = spawn(YTDLP, args)
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => reject(new Error(`yt-dlp not found at ${YTDLP}: ${err.message}`)))
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

/** Spawns yt-dlp streaming to stdout — pipe proc.stdout to response */
export function ytdlpStream(url: string, format: string) {
  const args = [...BASE_ARGS, '-f', format, '-o', '-', url]
  return spawn(YTDLP, args)
}
