import type { Metadata } from 'next'

import { CategoryNewsView } from '../../../_views/CategoryNewsView'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Новости по рубрике',
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CategoryNewsView slug={slug} />
}
