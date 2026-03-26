import { useState } from 'react'
import Head from 'next/head'
import VideoDownloader from '../components/VideoDownloader'
import StoriesDownloader from '../components/StoriesDownloader'

type Tab = 'video' | 'stories'

export default function Home() {
  const [tab, setTab] = useState<Tab>('video')

  return (
    <>
      <Head>
        <title>VidSnap — Download Videos & Stories</title>
        <meta name="description" content="Download YouTube, Instagram and Facebook videos. Download Instagram stories with full audio." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur border-b border-white/5 px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
              VidSnap
            </span>
            {/* Tab switcher */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
              <TabButton active={tab === 'video'} onClick={() => setTab('video')}>
                Video
              </TabButton>
              <TabButton active={tab === 'stories'} onClick={() => setTab('stories')}>
                Stories
              </TabButton>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-xl mx-auto px-4 py-10">
          {/* Page heading */}
          <div className="mb-8 text-center">
            {tab === 'video' ? (
              <>
                <h1 className="text-2xl font-bold">Download Any Video</h1>
                <p className="text-white/40 text-sm mt-1">
                  YouTube · Instagram · Facebook · and more
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">Instagram Stories</h1>
                <p className="text-white/40 text-sm mt-1">
                  Download stories with full audio — including songs
                </p>
              </>
            )}
          </div>

          {tab === 'video' ? <VideoDownloader /> : <StoriesDownloader />}
        </main>

        <footer className="text-center py-8 text-white/15 text-xs">
          Only download content you have rights to. Respect creators.
        </footer>
      </div>
    </>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-white/10 text-white'
          : 'text-white/40 hover:text-white/70'
      }`}
    >
      {children}
    </button>
  )
}
