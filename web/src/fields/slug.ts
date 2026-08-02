import type { Field } from 'payload'

// Простой slug-хелпер без внешних зависимостей. Юникод-aware (\p{L}\p{N}),
// поэтому кириллический заголовок даёт кириллический slug — это ок для IDN-сайта
// (сдк-калинино.вмалмыже.рф). Если slug задан вручную — нормализуем его; иначе берём из
// fieldToUse (по умолчанию title).
const formatSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export const slugField = (fieldToUse = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  index: true,
  label: 'Slug (адрес в URL)',
  admin: {
    position: 'sidebar',
    description: 'Заполняется автоматически из заголовка. Можно переопределить вручную.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.length > 0) return formatSlug(value)
        const fallback = data?.[fieldToUse]
        if (typeof fallback === 'string' && fallback.length > 0) return formatSlug(fallback)
        return value
      },
    ],
  },
})
