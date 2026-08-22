import config from '@payload-config'
import { getPayload } from 'payload'

import { withRetry } from '../../../lib/withRetry'
import type { CategoryDoc } from '../../../lib/portal'

/**
 * Рубрики для чипов ленты — только те, в которых есть ОПУБЛИКОВАННЫЕ посты.
 *
 * Иначе появляется чип, ведущий в пустоту: автоимпорт заводит рубрику в момент,
 * когда первый пост в ней ещё черновик и ждёт проверки в админке. Так случилось с
 * «Афишей» — рубрика возникла на сайте раньше, чем в ней появилось хоть что-то видимое.
 */
export async function getCategories(): Promise<CategoryDoc[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const [categories, posts] = await Promise.all([
        payload.find({ collection: 'categories', sort: 'order', limit: 100 }),
        payload.find({
          collection: 'posts',
          where: { _status: { equals: 'published' } },
          depth: 0,
          limit: 1000,
          pagination: false,
        }),
      ])

      const used = new Set(
        posts.docs
          .map((post) => (post as { category?: number | { id?: number } | null }).category)
          .map((category) => (typeof category === 'object' && category ? category.id : category))
          .filter((id): id is number => typeof id === 'number'),
      )

      return categories.docs.filter((category) => used.has(category.id)) as unknown as CategoryDoc[]
    })
  } catch {
    return []
  }
}
