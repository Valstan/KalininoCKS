import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { anyone } from '../access/anyone'
import { revalidateHome } from '../hooks/revalidateSiteContent'

// Редактируемые тексты главной страницы (герой + контакты). Без drafts:
// PATCH сразу публичен. Минимальный каркас — наполняется редактором позже.
export const HomeContent: GlobalConfig = {
  slug: 'home',
  label: 'Главная — тексты',
  access: { read: anyone, update: adminOrEditor },
  admin: { description: 'Тексты главной страницы: заголовок, подзаголовок, вступление, контакты.' },
  fields: [
    { name: 'title', type: 'text', label: 'Заголовок' },
    { name: 'subtitle', type: 'text', label: 'Подзаголовок' },
    { name: 'intro', type: 'textarea', label: 'Вступительный текст' },
    { name: 'contacts', type: 'textarea', label: 'Контакты' },
  ],
  hooks: { afterChange: [revalidateHome] },
}
