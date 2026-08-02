import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { populatePublishedAt } from '../hooks/populatePublishedAt'
import { revalidatePost, revalidatePostDelete } from '../hooks/revalidatePost'
import { slugField } from '../fields/slug'

// Новости сайта. Лента /news, страница /news/[slug], последние — на главной.
export const Posts: CollectionConfig<'posts'> = {
  slug: 'posts',
  labels: {
    singular: 'Новость',
    plural: 'Новости',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: authenticatedOrPublished,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'date', 'category', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      label: 'Дата новости',
      admin: {
        position: 'sidebar',
        description: 'Дата, отображаемая в ленте. Если пусто — берётся дата публикации.',
      },
    },
    {
      name: 'category',
      type: 'text',
      label: 'Рубрика',
      admin: {
        position: 'sidebar',
        description: 'Необязательная текстовая метка рубрики.',
      },
    },
    {
      name: 'cover',
      type: 'upload',
      label: 'Обложка',
      relationTo: 'media',
    },
    {
      name: 'gallery',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Галерея',
      admin: {
        position: 'sidebar',
        description: 'Фото из поста — показываются под текстом, клик открывает просмотр с листанием.',
      },
    },
    {
      name: 'videos',
      type: 'array',
      label: 'Видео',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Название',
        },
        {
          name: 'url',
          type: 'text',
          label: 'Ссылка (mp4 или VK player)',
          required: true,
        },
      ],
      admin: {
        description: 'Видео из поста. mp4 — встроенный плеер, ссылка VK — встраиваемый iframe.',
      },
    },
    {
      name: 'vkPostId',
      type: 'text',
      label: 'ID поста ВКонтакте',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Служебное поле импорта: идентификатор исходного поста в ВК (дедупликация).',
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Текст новости',
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
      admin: {
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    beforeChange: [populatePublishedAt],
    afterChange: [revalidatePost],
    afterDelete: [revalidatePostDelete],
  },
  versions: {
    drafts: true,
  },
}
