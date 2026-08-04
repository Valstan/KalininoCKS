import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import { withRetry } from '../../../lib/withRetry'
import { PostCard } from './NewsView'
import { CATEGORY_URL_PREFIX, type CategoryDoc, type PostListItem } from '../../../lib/portal'
import { getCategories } from './categories-data'

export async function CategoryNewsView({ slug }: { slug: string }) {
  const [categories, category, posts] = await Promise.all([
    getCategories(),
    getCategory(slug),
    getCategoryPosts(slug),
  ])
  if (!category) notFound()

  return (
    <section className="archive-section">
      <p className="eyebrow">Рубрика</p>
      <h1>{category.title || category.slug}</h1>
      {categories.length > 0 ? (
        <nav className="category-chips" aria-label="Рубрики">
          <Link href="/news">Все</Link>
          {categories.map((cat) =>
            cat.slug ? (
              <Link
                key={cat.id}
                className={cat.slug === slug ? 'is-active' : undefined}
                href={`${CATEGORY_URL_PREFIX}/${encodeURIComponent(cat.slug)}`}
              >
                {cat.title || cat.slug}
              </Link>
            ) : null,
          )}
        </nav>
      ) : null}
      {posts.length === 0 ? (
        <p className="muted">В этой рубрике пока нет новостей.</p>
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

async function getCategory(slug: string): Promise<CategoryDoc | null> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'categories',
        where: { slug: { equals: slug } },
        limit: 1,
      })
      return (res.docs[0] as unknown as CategoryDoc | undefined) ?? null
    })
  } catch {
    return null
  }
}

async function getCategoryPosts(slug: string): Promise<PostListItem[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'posts',
        where: { and: [{ _status: { equals: 'published' } }, { 'category.slug': { equals: slug } }] },
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
