import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import * as cheerio from 'cheerio'

export interface Review {
  id: string
  rating: number
  title: string
  body: string
  reviewerName: string
  location: string
  date: string
  isCertifiedBuyer: boolean
  permalink: string
}

// Mimic a real browser to reduce chance of being blocked
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
}

/**
 * dl.flipkart.com uses a JavaScript redirect, not an HTTP redirect.
 * So we download the page HTML and extract the real product URL from it.
 */
async function resolveUrl(startUrl: string): Promise<string> {
  const resp = await axios.get(startUrl, {
    headers: HEADERS,
    maxRedirects: 5,
    timeout: 20000,
    validateStatus: () => true,
  })

  const html: string = typeof resp.data === 'string' ? resp.data : ''

  // Patterns to find the real Flipkart product URL inside the page
  const patterns: RegExp[] = [
    // JS: window.location = "...", location.href = "...", location.replace("...")
    /(?:window\.location(?:\.href)?|location\.href|location\.replace\s*\()\s*[=\(]\s*["']((https?:\/\/[^"']+flipkart\.com[^"']+))["']/i,
    // meta refresh: <meta http-equiv="refresh" content="0; url=...">
    /content=["'][^"']*;\s*url=(https?:\/\/[^"'\s]+flipkart\.com[^"'\s]+)["']/i,
    // og:url
    /property=["']og:url["'][^>]+content=["'](https?:\/\/[^"']+flipkart\.com[^"']+)["']/i,
    /content=["'](https?:\/\/[^"']+flipkart\.com[^"']+)["'][^>]+property=["']og:url["']/i,
    // canonical link
    /rel=["']canonical["'][^>]+href=["'](https?:\/\/[^"']+flipkart\.com[^"']+)["']/i,
    // any flipkart product URL containing /p/ anywhere in the HTML
    /(https?:\/\/(?:www|m)\.flipkart\.com\/[^\s"'<>]+\/p\/[^\s"'<>&]+)/i,
  ]

  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m) {
      const url = (m[1] || m[0]).trim()
      if (url.includes('flipkart.com')) {
        return url
          .replace(/^https?:\/\/m\.flipkart\.com/, 'https://www.flipkart.com')
          .replace(/&amp;/g, '&')
      }
    }
  }

  // DEBUG: surface the raw response so we can see what dl.flipkart.com returns
  const statusCode = resp.status
  const preview = html.slice(0, 600).replace(/\s+/g, ' ')
  throw new Error(
    `[DEBUG] HTTP ${statusCode} — no product URL found. ` +
    `HTML preview: ${preview || '(empty body)'}`
  )
}

/**
 * Convert a Flipkart product URL to its review page URL.
 *
 * Product:  https://www.flipkart.com/{slug}/p/{itemId}?pid={pid}
 * Reviews:  https://www.flipkart.com/{slug}/product-reviews/{itemId}?pid={pid}&sortOrder=…&page=N
 */
function buildReviewUrl(productUrl: string, page: number, sortOrder: string): string {
  const u = new URL(productUrl)
  const parts = u.pathname.split('/').filter(Boolean)

  const pIdx = parts.indexOf('p')
  if (pIdx !== -1 && parts[pIdx + 1]) {
    parts[pIdx] = 'product-reviews'
  } else if (!u.pathname.includes('product-reviews')) {
    // Already a review URL or unknown format — just set params
  }

  u.pathname = '/' + parts.join('/')

  // Keep existing params (pid, lid) and layer in review-specific ones
  u.searchParams.set('marketplace', 'FLIPKART')
  u.searchParams.set('sortOrder', sortOrder)
  u.searchParams.set('page', String(page))
  u.searchParams.set('certifiedBuyer', 'false')
  u.searchParams.set('aid', 'overall')
  // Remove params that can cause 404 when empty or redundant
  u.searchParams.delete('rating')
  u.searchParams.delete('pageNumber')

  return u.toString()
}

function parseReviews(html: string, reviewPageUrl: string): Review[] {
  const $ = cheerio.load(html)
  const reviews: Review[] = []

  // ── Selector strategies (Flipkart changes class names on deploys) ──
  // We try from most specific → most generic
  const CONTAINER_SELECTORS = [
    '._27M-vq',           // 2023-2025 class
    '[data-review-id]',   // future-proof if Flipkart adds data attr
    '.EKFha-',            // alternate seen in some scrapes
    '.col.EPCmJX > div',  // structural fallback
  ]

  let containers = $()
  for (const sel of CONTAINER_SELECTORS) {
    containers = $(sel)
    if (containers.length > 0) break
  }

  // If nothing matched, Flipkart may have blocked or changed structure
  if (containers.length === 0) return reviews

  const baseForPermalink = (() => {
    try {
      const u = new URL(reviewPageUrl)
      return `${u.protocol}//${u.host}${u.pathname}`
    } catch {
      return reviewPageUrl.split('?')[0]
    }
  })()

  containers.each((i, el) => {
    try {
      const $el = $(el)

      // ── Review ID ──
      const reviewId = $el.attr('data-review-id') || `review-${Date.now()}-${i}`

      // ── Rating ──
      // Rating badge: a small div/span containing a single digit 1–5
      const RATING_SEL = ['._3LWZlK', '[class*="XQDdHH"]', '[class*="rating"]']
      let ratingText = ''
      for (const s of RATING_SEL) {
        ratingText = $el.find(s).first().text().trim()
        if (ratingText) break
      }
      // Structural fallback: find any element that is purely a digit 1-5
      if (!ratingText) {
        $el.find('div, span').each((_, e) => {
          const t = $(e).text().trim()
          if (/^[1-5]$/.test(t)) {
            ratingText = t
            return false // break
          }
        })
      }
      const rating = parseInt(ratingText) || 0

      // ── Title ──
      const TITLE_SEL = [
        '._2-N8zT._4WELSP',
        'p._2-N8zT',
        '[class*="Y-tTib"]',
        '[class*="review-title"]',
      ]
      let title = ''
      for (const s of TITLE_SEL) {
        title = $el.find(s).first().text().trim()
        if (title) break
      }

      // ── Body ──
      const BODY_SEL = [
        '._6K-7Co',
        '.t-ZTKy ._6K-7Co',
        '[class*="ZmyHeo"]',
        '[class*="review-desc"]',
        '[class*="review-body"]',
      ]
      let body = ''
      for (const s of BODY_SEL) {
        body = $el.find(s).first().text().trim()
        if (body) break
      }

      // ── Reviewer name ──
      // The name element contains the name as a text node + a "Certified Buyer" child span
      const NAME_SEL = ['._2sc7ZR._2FTkTp', 'p._2sc7ZR:not(._3LYOAd)', '._2sc7ZR']
      let reviewerName = ''
      for (const s of NAME_SEL) {
        const nameEl = $el.find(s).first()
        if (nameEl.length) {
          // Clone + strip child elements → pure name text
          reviewerName = nameEl.clone().children().remove().end().text().trim()
          if (reviewerName) break
        }
      }

      // ── Certified Buyer ──
      const isCertifiedBuyer =
        $el.find('._1WkVpR, [class*="certifiedBuyer"], [class*="Certified"]').length > 0

      // ── Location & Date ──
      // Flipkart renders: <img> City, State  <span>X days ago</span>
      const LOC_SEL = ['._2sc7ZR._3LYOAd', '._3LYOAd', '[class*="location"]']
      let location = ''
      let date = ''
      for (const s of LOC_SEL) {
        const locEl = $el.find(s).first()
        if (locEl.length) {
          // The span inside has the relative date
          date = locEl.find('span').first().text().trim()
          // Remove img + span, get remaining text as location
          const clone = locEl.clone()
          clone.find('img, span').remove()
          location = clone.text().trim()
          if (location || date) break
        }
      }

      // ── Permalink ──
      const permalink = `${baseForPermalink}?reviewId=${reviewId}`

      if (rating > 0 || title || body) {
        reviews.push({
          id: reviewId,
          rating,
          title,
          body,
          reviewerName,
          location,
          date,
          isCertifiedBuyer,
          permalink,
        })
      }
    } catch {
      // Skip malformed entries
    }
  })

  return reviews
}

export const config = {
  api: { responseLimit: false },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url, sortOrder = 'MOST_RECENT', pages = 1 } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A Flipkart URL is required.' })
  }
  if (!url.includes('flipkart.com')) {
    return res.status(400).json({ error: 'Please provide a valid Flipkart product URL.' })
  }

  const numPages = Math.min(Math.max(1, parseInt(String(pages)) || 1), 20)

  try {
    // Resolve short / affiliate URLs first
    let resolvedUrl = url
    if (url.includes('dl.flipkart.com') || /\/s\/[a-zA-Z0-9]+/.test(url)) {
      try {
        resolvedUrl = await resolveUrl(url)
      } catch (resolveErr: any) {
        return res.status(400).json({ error: resolveErr?.message ?? 'Could not resolve the short URL.' })
      }
    }

    const allReviews: Review[] = []

    for (let page = 1; page <= numPages; page++) {
      const reviewUrl = buildReviewUrl(resolvedUrl, page, sortOrder)

      let data: string
      try {
        const resp = await axios.get(reviewUrl, { headers: HEADERS, timeout: 30000 })
        data = resp.data
      } catch (fetchErr: any) {
        const status = fetchErr?.response?.status
        if (status === 404) {
          throw new Error(
            `Flipkart returned 404 for the review URL. ` +
            `Tried: ${reviewUrl} — Make sure the product URL is correct and contains /p/ in the path.`
          )
        }
        throw fetchErr
      }

      const pageReviews = parseReviews(data, reviewUrl)
      allReviews.push(...pageReviews)

      // Polite delay between pages to avoid rate-limiting
      if (page < numPages) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }

    if (allReviews.length === 0) {
      return res.status(200).json({
        reviews: [],
        total: 0,
        warning:
          'No reviews were parsed. Flipkart may have updated their HTML structure or temporarily blocked the request. Try again in a moment.',
      })
    }

    return res.status(200).json({ reviews: allReviews, total: allReviews.length })
  } catch (err: any) {
    console.error('[reviews api]', err?.message)
    return res.status(500).json({
      error:
        err?.response?.status === 403
          ? 'Flipkart blocked the request (403). Try again after a short wait.'
          : err.message || 'Failed to extract reviews.',
    })
  }
}
