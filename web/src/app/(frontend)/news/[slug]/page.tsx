import type { Metadata } from 'next'

import { PostView, postMeta } from '../../_views/PostView'

// Страница новости (Posts по slug). Тело — в _views/PostView.
export const revalidate = 60

type Args = { params: Promise<{ slug: string }> }

export default async function PostBySlug({ params }: Args) {
  const { slug } = await params
  return <PostView slug={slug} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  return postMeta(slug)
}
