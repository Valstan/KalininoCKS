import config from '@payload-config'
import { getPayload } from 'payload'

import { withRetry } from '../../../lib/withRetry'
import type { CategoryDoc } from '../../../lib/portal'

export async function getCategories(): Promise<CategoryDoc[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({ collection: 'categories', sort: 'order', limit: 100 })
      return res.docs as unknown as CategoryDoc[]
    })
  } catch {
    return []
  }
}
