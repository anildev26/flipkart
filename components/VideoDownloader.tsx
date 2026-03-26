import { useState, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type Quality = { label: string; quality: string }
type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  platform: string
  qualities: Quality[]
  usedCookies: boolean
  method: string
}

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: 'text-red-400',
  Instagram: 'text-pink-400',
  Facebook: 'text-blue-400',
  'Twitter/X': 'text-sky-400',
  Unknown: 'text-gray-400',
}

function formatDuration(secs: number): string {
  if (!secs) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function Skeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-white/5" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/4" />
        <div className="flex gap-2 pt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 w-16 bg-white/5 rounded-lg" />
          ))}
        </div>
        <div className="h-11 bg-white/5 rounded-xl" />
      </div>
    </div>
  )
}

export default function VideoDownloader() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Quality | null>(null)

  async function handleFetch(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setInfo(null)
    setSelected(null)

    try {
      const res = await fetch(`${API_URL}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInfo(data)
      setSelected(data.qualities[0] ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!selected || !info) return
    // Build download URL — hitting this endpoint streams yt-dlp output with audio+video merged.
    // Browser receives the stream and shows its native download progress bar.
    const filename = `${info.title.replace(/[^a-z0-9]/gi, '_').slice(0, 60)}.mp4`
    const href = `${API_URL}/api/download?url=${encodeURIComponent(url.trim())}&quality=${encodeURIComponent(selected.quality)}&filename=${encodeURIComponent(filename)}${info.usedCookies ? '&cookies=1' : ''}`
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* URL input */}
      <form onSubmit={handleFetch} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste YouTube, Instagram or Facebook link…"
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {loading ? 'Fetching…' : 'Get Video'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
      </form>

      {/* Skeleton while loading */}
      {loading && <Skeleton />}

      {/* Video info card */}
      {!loading && info && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {info.thumbnail && (
            <div className="relative aspect-video bg-black">
              <img
                src={info.thumbnail}
                alt={info.title}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className={`text-xs font-semibold ${PLATFORM_COLORS[info.platform]} bg-black/50 px-2 py-1 rounded-md`}>
                  {info.platform}
                </span>
                {info.duration > 0 && (
                  <span className="text-xs text-white/60 bg-black/50 px-2 py-1 rounded-md">
                    {formatDuration(info.duration)}
                  </span>
                )}
              </div>
              {/* Method badge — top right */}
              <div className="absolute top-3 right-3">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                  info.usedCookies
                    ? 'bg-yellow-500/80 text-black'
                    : 'bg-green-500/80 text-black'
                }`}>
                  {info.usedCookies ? '🍪' : '✓'} {info.method}
                </span>
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            <h2 className="font-semibold text-white leading-snug line-clamp-2">{info.title}</h2>

            {/* Quality selector */}
            {info.qualities.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">Select quality</p>
                <div className="flex flex-wrap gap-2">
                  {info.qualities.map(q => (
                    <button
                      key={q.quality}
                      onClick={() => setSelected(q)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selected?.quality === q.quality
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-white/5 border-border text-white/60 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Download button — triggers browser download popup */}
            <button
              onClick={handleDownload}
              disabled={!selected}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 rounded-xl font-semibold text-sm transition-all"
            >
              Download {selected?.label} · MP4
            </button>

            <p className="text-center text-white/25 text-xs">
              Your browser will show download progress in its download bar
            </p>
          </div>
        </div>
      )}

      {!info && !loading && (
        <div className="flex items-center justify-center gap-6 pt-2 text-xs">
          <span className="text-red-400/60">▶ YouTube</span>
          <span className="text-pink-400/60">◈ Instagram</span>
          <span className="text-blue-400/60">◉ Facebook</span>
        </div>
      )}
    </div>
  )
}
