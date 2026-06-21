import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { anyone } from '../access/anyone'
import { revalidateChrome } from '../hooks/revalidateSiteContent'

// Редактируемый текст подвала. Без drafts.
export const SiteFooter: GlobalConfig = {
  slug: 'footer',
  label: 'Подвал сайта',
  access: { read: anyone, update: adminOrEditor },
  admin: { description: 'Строка копирайта и контакты в подвале.' },
  fields: [
    { name: 'copyright', type: 'text', label: 'Копирайт' },
    { name: 'contacts', type: 'textarea', label: 'Контакты' },
  ],
  hooks: { afterChange: [revalidateChrome] },
}
