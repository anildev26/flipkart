import { useState, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type VideoFormat = {
  label: string
  url: string
  ext: string
  filesize?: number
}

type VideoInfo = {
  title: string
  thumbnail: string
  duration: number
  platform: string
  formats: VideoFormat[]
}

const PLATFORM_ICONS: Record<string, string> = {
  YouTube: '▶',
  Instagram: '◈',
  Facebook: '◉',
  'Twitter/X': '✕',
  Unknown: '◌',
}

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: 'text-red-400',
  Instagram: 'text-pink-400',
  Facebook: 'text-blue-400',
  'Twitter/X': 'text-sky-400',
  Unknown: 'text-gray-400',
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes > 1_000_000_000) return ` · ${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1_000_000) return ` · ${(bytes / 1e6).toFixed(0)} MB`
  return ` · ${(bytes / 1e3).toFixed(0)} KB`
}

export default function VideoDownloader() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<VideoInfo | null>(null)
  const [error, setError] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null)
  const [downloading, setDownloading] = useState(false)

  async function handleFetch(e: FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setInfo(null)
    setSelectedFormat(null)

    try {
      const res = await fetch(`${API_URL}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInfo(data)
      setSelectedFormat(data.formats[0] ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!selectedFormat || !info) return
    setDownloading(true)
    const filename = `${info.title.replace(/[^a-z0-9]/gi, '_').slice(0, 60)}.${selectedFormat.ext}`
    const proxyUrl = `${API_URL}/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&filename=${encodeURIComponent(filename)}`
    const a = document.createElement('a')
    a.href = proxyUrl
    a.download = filename
    a.click()
    setTimeout(() => setDownloading(false), 3000)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleFetch} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste YouTube, Instagram or Facebook video link…"
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

      {info && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {info.thumbnail && (
            <div className="relative aspect-video bg-black">
              <img src={info.thumbnail} alt={info.title} className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className={`text-xs font-semibold ${PLATFORM_COLORS[info.platform]} bg-black/50 px-2 py-1 rounded-md`}>
                  {PLATFORM_ICONS[info.platform]} {info.platform}
                </span>
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-white leading-snug line-clamp-2">{info.title}</h2>
              {info.duration > 0 && (
                <p className="text-white/40 text-xs mt-1">{formatDuration(info.duration)}</p>
              )}
            </div>

            {info.formats.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {info.formats.map(f => (
                  <button
                    key={f.url}
                    onClick={() => setSelectedFormat(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selectedFormat?.url === f.url
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-white/5 border-border text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {f.label}{formatSize(f.filesize)}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={!selectedFormat || downloading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm transition-all"
            >
              {downloading
                ? 'Starting download…'
                : `Download ${selectedFormat?.label ?? ''} · ${selectedFormat?.ext?.toUpperCase() ?? ''}`}
            </button>
          </div>
        </div>
      )}

      {!info && !loading && (
        <div className="flex items-center justify-center gap-6 pt-4 text-xs">
          <span className="text-red-400/60">▶ YouTube</span>
          <span className="text-pink-400/60">◈ Instagram</span>
          <span className="text-blue-400/60">◉ Facebook</span>
        </div>
      )}
    </div>
  )
}
