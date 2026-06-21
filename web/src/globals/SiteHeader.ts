import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { anyone } from '../access/anyone'
import { revalidateChrome } from '../hooks/revalidateSiteContent'

// Редактируемые тексты шапки: название сайта + пункты меню (подпись + адрес).
// Без drafts: PATCH сразу публичен.
export const SiteHeader: GlobalConfig = {
  slug: 'header',
  label: 'Шапка сайта',
  access: { read: anyone, update: adminOrEditor },
  admin: { description: 'Название сайта и пункты меню.' },
  fields: [
    { name: 'brand', type: 'text', label: 'Название сайта' },
    {
      name: 'nav',
      type: 'array',
      label: 'Пункты меню',
      labels: { singular: 'Пункт', plural: 'Пункты' },
      fields: [
        { name: 'label', type: 'text', label: 'Подпись', required: true },
        { name: 'href', type: 'text', label: 'Адрес (URL)', required: true },
      ],
    },
  ],
  hooks: { afterChange: [revalidateChrome] },
}
