import type { Metadata } from 'next'
import Image from 'next/image'
import config from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'

import { SITE_NAME } from '../../../lib/site'
import { withRetry } from '../../../lib/withRetry'
import { RichText } from '../../../lib/RichText'
import { formatPostDate } from '../../../lib/format'

type MediaDoc = { url?: string | null; alt?: string | null; width?: number | null; height?: number | null }
type PostDoc = {
  title?: string | null
  date?: string | null
  publishedAt?: string | null
  category?: string | null
  content?: unknown
  cover?: MediaDoc | string | number | null
}

async function getPost(slug: string): Promise<PostDoc | null> {
  return withRetry(async () => {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug }, _status: { equals: 'published' } },
      depth: 1,
      limit: 1,
    })
    return (res.docs[0] as PostDoc | undefined) ?? null
  })
}

export async function postMeta(slug: string): Promise<Metadata> {
  try {
    const post = await getPost(slug)
    if (!post) return {}
    return { title: post.title || SITE_NAME }
  } catch {
    return {}
  }
}

export async function PostView({ slug }: { slug: string }) {
  const post = await getPost(decodeURIComponent(slug))
  if (!post) notFound()

  const cover = typeof post.cover === 'object' && post.cover ? (post.cover as MediaDoc) : null

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="post-list__meta">
        {formatPostDate(post.date || post.publishedAt)}
        {post.category ? ` · ${post.category}` : ''}
      </p>
      {cover?.url ? (
        <Image
          className="post-cover"
          src={cover.url}
          alt={cover.alt || post.title || ''}
          width={cover.width || 1200}
          height={cover.height || 675}
        />
      ) : null}
      <RichText data={post.content} />
    </article>
  )
}
