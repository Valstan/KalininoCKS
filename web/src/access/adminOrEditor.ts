import type { Access } from 'payload'

// Серверный write-authz: только персонал (admin/editor), НЕ «любой authenticated».
// Это и есть pool #015 — серверный access должен 1:1 совпадать с клиентским edit-гейтом.
export const adminOrEditor: Access = ({ req: { user } }) => {
  if (!user || !Array.isArray(user.roles)) return false
  return user.roles.includes('admin') || user.roles.includes('editor')
}
