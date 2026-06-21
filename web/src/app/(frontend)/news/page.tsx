import type { Metadata } from 'next'

import { NewsView } from '../_views/NewsView'

// Лента новостей. Тело — _views/NewsView. ISR.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Новости',
}

export default function NewsPage() {
  return <NewsView />
}
