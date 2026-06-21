import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { adminOrSelf } from '../access/adminOrSelf'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Пользователь',
    plural: 'Пользователи',
  },
  access: {
    // Кто может войти в админку: персонал (админ + редактор).
    admin: ({ req: { user } }) =>
      Boolean(
        user &&
          Array.isArray(user.roles) &&
          (user.roles.includes('admin') || user.roles.includes('editor')),
      ),
    create: adminOnly,
    delete: adminOnly,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    {
      name: 'roles',
      type: 'select',
      label: 'Роли',
      hasMany: true,
      required: true,
      defaultValue: ['editor'],
      saveToJWT: true,
      options: [
        { label: 'Администратор', value: 'admin' },
        { label: 'Редактор', value: 'editor' },
      ],
      access: {
        // Менять роли может только админ (защита от самоповышения привилегий).
        update: ({ req: { user } }) =>
          Boolean(user && Array.isArray(user.roles) && user.roles.includes('admin')),
      },
    },
  ],
  timestamps: true,
}
