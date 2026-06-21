import type { Access } from 'payload'

// Персонал видит черновики; гость — только опубликованное.
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true

  return {
    _status: {
      equals: 'published',
    },
  }
}
