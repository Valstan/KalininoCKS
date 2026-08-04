import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { anyone } from '../access/anyone'
import { slugField } from '../fields/slug'

// Рубрики новостей. Управляемый список: импорт из ВК создаёт рубрику по slug
// (словарь скрипта), редактор правит названия и порядок в админке.
export const Categories: CollectionConfig<'categories'> = {
  slug: 'categories',
  labels: {
    singular: 'Рубрика',
    plural: 'Рубрики',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'order', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Название',
      required: true,
    },
    {
      name: 'order',
      type: 'number',
      label: 'Порядок в меню',
      defaultValue: 0,
      admin: {
        description: 'Меньше — выше в списке рубрик.',
      },
    },
    slugField('title', { unique: true }),
  ],
}
