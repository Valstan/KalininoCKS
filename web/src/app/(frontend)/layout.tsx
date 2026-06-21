import type { Metadata } from 'next'
import config from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import './globals.css'
import { SITE_DESC, SITE_NAME, SITE_URL } from '../../lib/site'
import { withRetry } from '../../lib/withRetry'
import type { ChromeContent, NavItem } from './components/SiteChrome'
import { SiteChrome } from './components/SiteChrome'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESC,
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESC,
    url: '/',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    type: 'website',
  },
}

// Редактируемые тексты шапки/подвала (глобалы header/footer). Пусто/сбой
// (в т.ч. отсутствие таблиц в build-БД) → null → SiteChrome падает на код-фолбэк.
async function getChrome(): Promise<ChromeContent> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const [header, footer] = await Promise.all([
        payload.findGlobal({ slug: 'header', depth: 0 }),
        payload.findGlobal({ slug: 'footer', depth: 0 }),
      ])
      const nav: NavItem[] = (Array.isArray(header?.nav) ? header.nav : [])
        .map((n) => ({ label: String(n.label ?? ''), href: String(n.href ?? '') }))
        .filter((n) => n.label && n.href)
      return {
        brand: (header?.brand as string | null) ?? null,
        nav,
        copyright: (footer?.copyright as string | null) ?? null,
        contacts: (footer?.contacts as string | null) ?? null,
      }
    })
  } catch {
    return null
  }
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getChrome()
  return (
    <html lang="ru">
      <body>
        <SiteChrome chrome={chrome}>{children}</SiteChrome>
      </body>
    </html>
  )
}
