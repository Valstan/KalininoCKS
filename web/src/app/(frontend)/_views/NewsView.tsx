import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

import { withRetry } from '../../../lib/withRetry'
import { formatPostDate } from '../../../lib/format'

type PostListItem = {
  id: string | number
  title?: string | null
  slug?: string | null
  date?: string | null
  publishedAt?: string | null
  category?: string | null
}

async function getPosts(): Promise<PostListItem[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'posts',
        where: { _status: { equals: 'published' } },
        sort: '-date',
        depth: 0,
        limit: 100,
      })
      return res.docs as PostListItem[]
    })
  } catch {
    return []
  }
}

export async function NewsView() {
  const posts = await getPosts()

  return (
    <section>
      <h1>Новости</h1>
      {posts.length === 0 ? (
        <p className="muted">Пока нет новостей.</p>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.id} className="post-list__item">
              <h2>
                <Link href={`/news/${encodeURIComponent(post.slug ?? '')}`}>
                  {post.title || 'Без заголовка'}
                </Link>
              </h2>
              <p className="post-list__meta">
                {formatPostDate(post.date || post.publishedAt)}
                {post.category ? ` · ${post.category}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
