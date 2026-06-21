import type { Access } from 'payload'

export const adminOnly: Access = ({ req: { user } }) => {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes('admin'))
}
