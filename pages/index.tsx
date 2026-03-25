import { useState, useMemo, useRef } from 'react'
import Head from 'next/head'
import type { Review } from './api/reviews'

const SORT_OPTIONS = [
  { value: 'MOST_RECENT', label: 'Most Recent' },
  { value: 'MOST_HELPFUL', label: 'Most Helpful' },
  { value: 'POSITIVE_FIRST', label: 'Positive First' },
  { value: 'NEGATIVE_FIRST', label: 'Negative First' },
]

function ratingBg(rating: number) {
  if (rating >= 4) return 'bg-green-600'
  if (rating === 3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function StarIcon() {
  return (
    <svg className="w-3 h-3 inline-block" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface ReviewCardProps {
  review: Review
  copiedId: string | null
  onCopy: (id: string, permalink: string) => void
  highlight: string
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function ReviewCard({ review, copiedId, onCopy, highlight }: ReviewCardProps) {
  const copied = copiedId === review.id

  return (
    <div className="bg-[#1e2640] rounded-2xl p-5 shadow-lg border border-[#2d3a55]">
      {/* Top row: rating badge + copy link */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white font-bold text-sm ${ratingBg(
            review.rating
          )}`}
        >
          {review.rating} <StarIcon />
        </span>

        <button
          onClick={() => onCopy(review.id, review.permalink)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
            copied
              ? 'border-green-500/60 text-green-400 bg-green-500/10'
              : 'border-[#3d4f6e] text-[#a0aec0] hover:border-purple-500/70 hover:text-purple-300 hover:bg-purple-500/10'
          }`}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <LinkIcon className="w-3.5 h-3.5" />
              Copy Link
            </>
          )}
        </button>
      </div>

      {/* Review title */}
      {review.title && (
        <h3 className="font-bold text-white text-[15px] mb-2 leading-snug">{review.title}</h3>
      )}

      {/* Review body */}
      {review.body && (
        <p className="text-[#b0bec5] text-sm leading-relaxed mb-4">{review.body}</p>
      )}

      {/* Reviewer info */}
      <div className="pt-3 border-t border-[#2d3a55]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-white text-sm">
            {highlightText(review.reviewerName || 'Anonymous', highlight)}
          </span>
          {review.isCertifiedBuyer && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <CheckIcon className="w-3.5 h-3.5" />
              Certified Buyer
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {review.location && (
            <span className="flex items-center gap-1 text-xs text-[#718096]">
              <PinIcon className="w-3 h-3 flex-shrink-0" />
              {review.location}
            </span>
          )}
          {review.date && (
            <span className="text-xs text-[#718096]">{review.date}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [sortOrder, setSortOrder] = useState('MOST_RECENT')
  const [pages, setPages] = useState('1')
  const [loading, setLoading] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const [searchName, setSearchName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredReviews = useMemo(() => {
    const q = searchName.trim().toLowerCase()
    if (!q) return reviews
    return reviews.filter((r) => r.reviewerName.toLowerCase().includes(q))
  }, [reviews, searchName])

  const handleExtract = async () => {
    if (!url.trim() || loading) return
    setLoading(true)
    setError('')
    setWarning('')
    setReviews([])
    setSearchName('')

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), sortOrder, pages: parseInt(pages) || 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed.')

      setReviews(data.reviews)
      if (data.warning) setWarning(data.warning)

      // Scroll to results then focus search
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setTimeout(() => searchRef.current?.focus(), 400)
      }, 100)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (id: string, permalink: string) => {
    try {
      await navigator.clipboard.writeText(permalink)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = permalink
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      <Head>
        <title>Flipkart Review Extractor</title>
        <meta name="description" content="Extract reviews, ratings, and images from any Flipkart product URL" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-[#0f1521] text-white">
        <div className="max-w-2xl mx-auto px-4 py-10 pb-16">

          {/* ── Header ── */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
              Flipkart Review Extractor
            </h1>
            <p className="text-[#718096] text-sm">
              Extract reviews, ratings, and images from any Flipkart product URL
            </p>
          </div>

          {/* ── Form Card ── */}
          <div className="bg-[#1a2035] rounded-2xl p-6 shadow-xl mb-6">
            <p className="text-[#718096] text-sm text-center mb-6 leading-relaxed">
              Please avoid using short URLs or affiliate links, as they increase the time required
              to extract reviews.
            </p>

            {/* URL */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-white mb-2">
                Flipkart Product URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                placeholder="https://www.flipkart.com/..."
                className="w-full bg-[#252d45] text-white placeholder-[#4a5568] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>

            {/* Sort */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-white mb-2">
                Sort Reviews By
              </label>
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-[#252d45] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition appearance-none pr-10"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                  <svg className="w-4 h-4 text-[#718096]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pages */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-1">
                How many pages? &nbsp;
                <span className="font-normal text-[#718096]">(1 page = 10 reviews, max 20)</span>
              </label>
              <input
                type="number"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                min={1}
                max={20}
                className="w-full bg-[#252d45] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>

            {/* Extract Button */}
            <button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
              className="w-full bg-[#6c5ce7] hover:bg-[#5b4dd6] active:bg-[#4e41c9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-[15px] tracking-wide"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Extracting...
                </>
              ) : (
                'Extract Reviews'
              )}
            </button>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* ── Results ── */}
          {(reviews.length > 0 || warning) && (
            <div ref={resultsRef} className="scroll-mt-4">

              {warning && (
                <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-xl p-4 mb-4 text-yellow-300 text-sm">
                  {warning}
                </div>
              )}

              {reviews.length > 0 && (
                <>
                  {/* Results header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">
                      {reviews.length} Reviews Found
                    </h2>
                    {searchName.trim() && (
                      <span className="text-sm text-[#718096]">
                        {filteredReviews.length} match{filteredReviews.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {/* ── Search by name ── */}
                  <div className="relative mb-5">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096] pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      placeholder="Search by reviewer name…"
                      className="w-full bg-[#1a2035] text-white placeholder-[#4a5568] rounded-xl pl-10 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 border border-[#2d3a55] transition"
                    />
                    {searchName && (
                      <button
                        onClick={() => setSearchName('')}
                        className="absolute inset-y-0 right-3.5 flex items-center text-[#718096] hover:text-white transition"
                        aria-label="Clear search"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* No match */}
                  {filteredReviews.length === 0 && searchName.trim() && (
                    <div className="text-center py-12 text-[#718096]">
                      <SearchIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p>No reviews found for &ldquo;{searchName}&rdquo;</p>
                    </div>
                  )}

                  {/* Review cards */}
                  <div className="flex flex-col gap-4">
                    {filteredReviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        copiedId={copiedId}
                        onCopy={handleCopy}
                        highlight={searchName}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
