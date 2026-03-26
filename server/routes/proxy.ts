import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { url, filename } = req.query
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url param is required' })
  }

  try {
    const upstream = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.instagram.com/',
      },
    })

    const contentType = upstream.headers['content-type'] || 'video/mp4'
    const fname = (filename as string | undefined) || 'video.mp4'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length'])
    }

    upstream.data.pipe(res)
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to stream video.' })
    }
  }
})

export default router
