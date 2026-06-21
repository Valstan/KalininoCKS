import type { MetadataRoute } from 'next'

import config from '@payload-config'
import { getPayload } from 'payload'

// /sitemap.xml — страницы (Pages), новости (Posts) + статические маршруты.
//
// force-dynamic — строим в рантайме против реальной прод-БД, НЕ пререндерим в сборке
// (иначе в бандл запекается вырожденный sitemap против пустой build-БД).
export const dynamic = 'force-dynamic'

const baseUrl = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3006').replace(/\/$/, '')

type Coll = 'pages' | 'posts'
type Doc = { slug?: string | null; updatedAt?: string | null }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/news`, changeFrequency: 'daily', priority: 0.8 },
  ]

  let payload: Awaited<ReturnType<typeof getPayload>>
  try {
    payload = await getPayload({ config })
  } catch (e) {
    console.error('[sitemap] getPayload failed:', e)
    return entries
  }

  const collect = async (collection: Coll, prefix: string) => {
    try {
      const res = await payload.find({
        collection,
        where: { _status: { equals: 'published' } },
        depth: 0,
        limit: 1000,
        pagination: false,
      })
      for (const doc of res.docs as Doc[]) {
        if (!doc.slug) continue
        entries.push({
          url: `${baseUrl}${prefix}/${encodeURIComponent(doc.slug)}`,
          lastModified: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
          changeFrequency: 'weekly',
        })
      }
    } catch (e) {
      console.error(`[sitemap] ${collection} query failed:`, e)
    }
  }

  await collect('pages', '/pages')
  await collect('posts', '/news')

  return entries
}
