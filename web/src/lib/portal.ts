export type CategoryDoc = {
  id: number | string
  title?: string | null
  slug?: string | null
  order?: number | null
}

export type PostListItem = {
  id: number | string
  title?: string | null
  slug?: string | null
  date?: string | null
  publishedAt?: string | null
  category?: CategoryDoc | string | number | null
  cover?: {
    url?: string | null
    sizes?: Record<string, { url?: string | null } | null> | null
  } | string | number | null
}

export const CATEGORY_URL_PREFIX = '/news/category'
