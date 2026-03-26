import { useState, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type Story = {
  id: string
  thumbnail: string
  videoUrl: string
  timestamp?: number
  isVideo: boolean
}

function CookieHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-purple-400 text-xs hover:text-purple-300 underline underline-offset-2"
      >
        How to get Session ID?
      </button>
      {open && (
        <div className="mt-3 bg-white/5 border border-border rounded-xl p-4 text-xs text-white/70 space-y-2">
          <p className="font-semibold text-white/90">Steps (Chrome / Edge):</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Open <span className="text-purple-300">instagram.com</span> and log in</li>
            <li>Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">F12</kbd> to open DevTools</li>
            <li>Go to <span className="text-purple-300">Application → Cookies → instagram.com</span></li>
            <li>Find <span className="text-purple-300">sessionid</span> and copy its value</li>
          </ol>
          <p className="text-yellow-400/80 pt-1">
            Your session ID is never stored — it is used only for this request.
          </p>
        </div>
      )}
    </div>
  )
}

function StoryCard({ story, username }: { story: Story; username: string }) {
  const [downloading, setDownloading] = useState(false)

  function download() {
    setDownloading(true)
    const ext = story.isVideo ? 'mp4' : 'jpg'
    const filename = `${username}_story_${story.id}.${ext}`
    const proxyUrl = `${API_URL}/api/proxy?url=${encodeURIComponent(story.videoUrl)}&filename=${encodeURIComponent(filename)}`
    const a = document.createElement('a')
    a.href = proxyUrl
    a.download = filename
    a.click()
    setTimeout(() => setDownloading(false), 3000)
  }

  return (
    <div className="relative group rounded-xl overflow-hidden bg-card border border-border aspect-[9/16]">
      {story.thumbnail ? (
        <img src={story.thumbnail} alt="Story" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">
          {story.isVideo ? '▶' : '◻'}
        </div>
      )}

      {story.isVideo && (
        <div className="absolute top-2 left-2 bg-black/60 rounded-md px-1.5 py-0.5 text-[10px] text-white/80">
          VIDEO
        </div>
      )}

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={download}
          disabled={downloading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {downloading ? 'Saving…' : 'Download'}
        </button>
      </div>
    </div>
  )
}

export default function StoriesDownloader() {
  const [username, setUsername] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stories, setStories] = useState<Story[]>([])
  const [fetchedUser, setFetchedUser] = useState('')

  async function handleFetch(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !sessionId.trim()) return
    setLoading(true)
    setError('')
    setStories([])

    try {
      const res = await fetch(`${API_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), sessionId: sessionId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (!data.stories.length) throw new Error('No active stories found for this account.')
      setStories(data.stories)
      setFetchedUser(data.username)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleFetch} className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Instagram username (e.g. natgeo)"
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 transition-colors"
        />

        <div className="space-y-2">
          <input
            type="password"
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
            placeholder="Paste your Instagram session ID…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 transition-colors font-mono"
          />
          <CookieHelp />
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !sessionId.trim()}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? 'Fetching stories…' : 'Fetch Stories'}
        </button>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
      </form>

      {stories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/70">
              @{fetchedUser} · {stories.length} {stories.length === 1 ? 'story' : 'stories'}
            </h3>
            <span className="text-xs text-white/30">Hover to download</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stories.map(story => (
              <StoryCard key={story.id} story={story} username={fetchedUser} />
            ))}
          </div>
        </div>
      )}

      {!stories.length && !loading && (
        <p className="text-center text-white/25 text-xs pt-2">
          Downloads stories with full audio — including licensed songs stripped by Instagram's save button
        </p>
      )}
    </div>
  )
}
