import type { Access } from 'payload'

// Админ читает/правит всех; обычный пользователь — только свою запись.
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true
  return {
    id: {
      equals: user.id,
    },
  }
}
