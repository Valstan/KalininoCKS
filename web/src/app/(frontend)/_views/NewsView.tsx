import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

import { withRetry } from '../../../lib/withRetry'
import { formatPostDate } from '../../../lib/format'
import { CATEGORY_URL_PREFIX, type CategoryDoc, type PostListItem } from '../../../lib/portal'
import { getCategories } from './categories-data'

async function getPosts(): Promise<PostListItem[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'posts',
        where: { _status: { equals: 'published' } },
        sort: '-date',
        depth: 1,
        limit: 100,
      })
      return res.docs as unknown as PostListItem[]
    })
  } catch {
    return []
  }
}

export async function NewsView() {
  const [posts, categories] = await Promise.all([getPosts(), getCategories()])

  return (
    <section className="archive-section">
      <p className="eyebrow">Лента событий</p>
      <h1>Новости</h1>
      {categories.length > 0 ? (
        <nav className="category-chips" aria-label="Рубрики">
          <Link className="is-active" href="/news">
            Все
          </Link>
          {categories.map((cat) =>
            cat.slug ? (
              <Link key={cat.id} href={`${CATEGORY_URL_PREFIX}/${encodeURIComponent(cat.slug)}`}>
                {cat.title || cat.slug}
              </Link>
            ) : null,
          )}
        </nav>
      ) : null}
      {posts.length === 0 ? (
        <p className="muted">Пока нет новостей.</p>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function PostCard({ post, heading = 'h3' }: { post: PostListItem; heading?: 'h2' | 'h3' }) {
  const category =
    typeof post.category === 'object' && post.category ? (post.category as CategoryDoc) : null
  const cover =
    typeof post.cover === 'object' && post.cover
      ? (post.cover as { url?: string | null; sizes?: Record<string, { url?: string | null } | null> | null })
      : null
  const thumb = cover?.sizes?.card?.url || cover?.url || null
  const H = heading

  return (
    <li className="post-list__item post-card">
      {thumb ? (
        <Link
          className="post-card__thumb"
          href={`/news/${encodeURIComponent(post.slug ?? '')}`}
          tabIndex={-1}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- превью в ленте */}
          <img src={thumb} alt="" loading="lazy" />
        </Link>
      ) : null}
      <div className="post-card__body">
        <H>
          <Link href={`/news/${encodeURIComponent(post.slug ?? '')}`}>
            {post.title || 'Без заголовка'}
          </Link>
        </H>
        <p className="post-list__meta">
          {formatPostDate(post.date || post.publishedAt)}
          {category?.slug ? (
            <>
              {' · '}
              <Link href={`${CATEGORY_URL_PREFIX}/${encodeURIComponent(category.slug)}`}>
                {category.title || category.slug}
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </li>
  )
}
