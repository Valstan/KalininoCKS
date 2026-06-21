import type { GlobalAfterChangeHook } from 'payload'

import { safeRevalidatePath } from '../lib/safeRevalidate'

// On-demand ISR для глобалов контента сайта.
// home → главная.
export const revalidateHome: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info('[revalidate] home → /')
    safeRevalidatePath('/', 'page')
  }
  return doc
}

// header/footer рендерятся в корневом layout на КАЖДОЙ странице →
// инвалидируем весь поддеревом как layout.
export const revalidateChrome: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info('[revalidate] header/footer → / (layout)')
    safeRevalidatePath('/', 'layout')
  }
  return doc
}
