import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { Page } from '../payload-types'
import { safeRevalidatePath } from '../lib/safeRevalidate'

// On-demand ISR для статических страниц (/pages/[slug]). Route-литерал
// '/pages/[slug]' покрывает все страницы независимо от кодировки slug.
const revalidatePagePaths = (payload: { logger: { info: (m: string) => void } }) => {
  payload.logger.info('[revalidate] pages → /pages/[slug]')
  safeRevalidatePath('/pages/[slug]', 'page')
}

export const revalidatePageDoc: CollectionAfterChangeHook<Page> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) revalidatePagePaths(payload)
  return doc
}

export const revalidatePageDelete: CollectionAfterDeleteHook<Page> = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) revalidatePagePaths(payload)
  return doc
}
