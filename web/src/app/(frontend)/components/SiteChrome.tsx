import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { AUTHOR_URL, SITE_NAME } from '../../../lib/site'

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
        <div className="welcome-ribbon" aria-hidden="true">
          <span>✦</span>
          <span>Калинино — здесь праздник собирает своих</span>
          <span>✦</span>
        </div>
        <div className="container site-header__inner">
          <Link href="/" className="site-brand">
            <Image
              className="site-brand__mark"
              src="/brand/kalinino-emblem.webp"
              alt=""
              width={112}
              height={112}
              priority
            />
            <span className="site-brand__text">
              <small>Централизованная клубная система</small>
              <strong>{brand}</strong>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Основная навигация">
            {nav.map((item, i) => (
              <Link key={`${item.href}-${i}`} href={item.href}>
                {item.label}
              </Link>
            ))}
            {/* Экосистема Малмыжа (мандат brain 08.08, стандарт онбординга сервиса):
                бренд-фиксированная ссылка на каталог сайтов района — потому в коде,
                а не в редактируемых глобалах. Хост в punycode: юникод-домен в
                абсолютных URL ломает шаринг в ВК (G133/G134). */}
            <a
              className="site-nav__services"
              href="https://xn--b1ae3a1a.xn--80adkdyec4j.xn--p1ai/services"
              target="_blank"
              rel="noopener noreferrer"
            >
              Сервисы Малмыжа
            </a>
          </nav>
        </div>
      </header>

      <main className="site-main container">{children}</main>

      <footer className="site-footer">
        <Image
          className="site-footer__garland"
          src="/brand/folk-garland.webp"
          alt=""
          width={1930}
          height={815}
        />
        <div className="container site-footer__inner">
          <div>
            <p className="site-footer__eyebrow">Заходите на огонёк</p>
            {chrome?.contacts ? <p className="site-footer__contacts">{chrome.contacts}</p> : null}
            <p className="site-footer__copyright">{copyright}</p>
            <p className="site-footer__author">
              Разработка —{' '}
              <a href={AUTHOR_URL} rel="author noopener noreferrer" target="_blank">
                Валентин Савиных
              </a>
            </p>
          </div>
          <Image
            className="site-footer__mark"
            src="/brand/kalinino-emblem.webp"
            alt="Эмблема Калинино ЦКС"
            width={260}
            height={260}
          />
        </div>
      </footer>
    </div>
  )
}
