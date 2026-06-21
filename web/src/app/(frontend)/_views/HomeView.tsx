import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

import { SITE_NAME } from '../../../lib/site'
import { withRetry } from '../../../lib/withRetry'
import { formatPostDate } from '../../../lib/format'

type Home = {
  title?: string | null
  subtitle?: string | null
  intro?: string | null
  contacts?: string | null
}

type PostListItem = {
  id: string | number
  title?: string | null
  slug?: string | null
  date?: string | null
  publishedAt?: string | null
  category?: string | null
}

async function getHome(): Promise<Home | null> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      return (await payload.findGlobal({ slug: 'home', depth: 0 })) as Home
    })
  } catch {
    return null
  }
}

async function getLatestPosts(): Promise<PostListItem[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'posts',
        where: { _status: { equals: 'published' } },
        sort: '-date',
        depth: 0,
        limit: 5,
      })
      return res.docs as PostListItem[]
    })
  } catch {
    return []
  }
}

export async function HomeView() {
  const [home, posts] = await Promise.all([getHome(), getLatestPosts()])

  return (
    <>
      <section>
        <h1>{home?.title || SITE_NAME}</h1>
        {home?.subtitle ? <p className="muted">{home.subtitle}</p> : null}
        {home?.intro ? <p>{home.intro}</p> : null}
      </section>

      <section>
        <h2>Новости</h2>
        {posts.length === 0 ? (
          <p className="muted">Пока нет новостей.</p>
        ) : (
          <ul className="post-list">
            {posts.map((post) => (
              <li key={post.id} className="post-list__item">
                <h3>
                  <Link href={`/news/${encodeURIComponent(post.slug ?? '')}`}>
                    {post.title || 'Без заголовка'}
                  </Link>
                </h3>
                <p className="post-list__meta">
                  {formatPostDate(post.date || post.publishedAt)}
                  {post.category ? ` · ${post.category}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/news">Все новости →</Link>
        </p>
      </section>

      {home?.contacts ? (
        <section>
          <h2>Контакты</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{home.contacts}</p>
        </section>
      ) : null}
    </>
  )
}
