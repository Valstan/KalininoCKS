import Link from 'next/link'
import React from 'react'

import { SITE_NAME } from '../../../lib/site'

export type NavItem = { label: string; href: string }
export type ChromeContent = {
  brand: string | null
  nav: NavItem[]
  copyright: string | null
  contacts: string | null
} | null

// Шапка + подвал сайта. Тексты приходят из глобалов header/footer (могут быть
// пустыми в свежем каркасе) — тогда падаем на код-фолбэк.
export function SiteChrome({
  chrome,
  children,
}: {
  chrome: ChromeContent
  children: React.ReactNode
}) {
  const brand = chrome?.brand || SITE_NAME
  const nav = chrome?.nav?.length ? chrome.nav : [{ label: 'Новости', href: '/news' }]
  const copyright = chrome?.copyright || `© ${new Date().getFullYear()} ${SITE_NAME}`

  return (
    <div className="site">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="site-brand">
            {brand}
          </Link>
          <nav className="site-nav">
            {nav.map((item, i) => (
              <Link key={`${item.href}-${i}`} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="site-main container">{children}</main>

      <footer className="site-footer">
        <div className="container">
          {chrome?.contacts ? <p className="site-footer__contacts">{chrome.contacts}</p> : null}
          <p className="site-footer__copyright">{copyright}</p>
        </div>
      </footer>
    </div>
  )
}
