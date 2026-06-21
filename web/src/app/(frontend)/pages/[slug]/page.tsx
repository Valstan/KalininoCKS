import type { Metadata } from 'next'

import { PageView, pageMeta } from '../../_views/PageView'

// Статические страницы (Pages по slug). Тело — в _views/PageView.
export const revalidate = 60

type Args = { params: Promise<{ slug: string }> }

export default async function PageBySlug({ params }: Args) {
  const { slug } = await params
  return <PageView slug={slug} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  return pageMeta(slug)
}
