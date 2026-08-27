'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Счётчик Яндекс.Метрики (мандат brain 2026-08-09, решение владельца D-017).
 *
 * Принципы:
 *  - **включается без пересборки**: номер счётчика берётся с `/api/analytics-config`
 *    (force-dynamic, читает env сервера на запросе). `NEXT_PUBLIC_*` не годится — он
 *    запекается в CI-бандл. Пустой env → ноль → компонент не грузит ничего.
 *  - **отложенная загрузка**: конфиг запрашивается после гидратации, скрипт — через
 *    `requestIdleCallback`, чтобы не конкурировать с ней.
 *  - **без Вебвизора**: записи сессий посетителей не ведём (в кабинете счётчика тоже
 *    выключено) — сельскому клубу они не нужны, а это персональные данные.
 *  - **SPA-навигация**: Метрика сама видит только первую загрузку, на смену pathname
 *    шлём `ym('hit')`.
 *
 * Видимая цифра посещаемости в подвале — отдельно и не через этот тег:
 * `app/api/analytics-informer` проксирует картинку через свой origin.
 */

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void
  }
}

const loadMetrika = (id: number) => {
  if (window.ym) return
  const w = window as unknown as Record<string, unknown>
  const ym = function (...args: unknown[]) {
    const self = ym as unknown as { a?: unknown[][] }
    ;(self.a = self.a || []).push(args)
  }
  ;(ym as unknown as { l: number }).l = Date.now()
  w.ym = ym
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://mc.yandex.ru/metrika/tag.js'
  document.head.appendChild(s)
  window.ym!(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  })
}

const runDeferred = (fn: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 4000 })
  } else {
    setTimeout(fn, 1500)
  }
}

export function Analytics(): null {
  const [counterId, setCounterId] = useState(0)
  const loadedRef = useRef(false)
  const lastHitRef = useRef<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    fetch('/api/analytics-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ymCounterId?: number } | null) => {
        const id = Number(data?.ymCounterId) || 0
        if (!cancelled && id > 0) setCounterId(id)
      })
      .catch(() => {
        /* аналитика — необязательный слой; сбой конфига молча = выключено */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!counterId || loadedRef.current) return
    loadedRef.current = true
    runDeferred(() => {
      loadMetrika(counterId)
      lastHitRef.current = window.location.pathname
    })
  }, [counterId])

  useEffect(() => {
    if (!loadedRef.current || !counterId || !pathname || lastHitRef.current === pathname) return
    lastHitRef.current = pathname
    if (window.ym) window.ym(counterId, 'hit', window.location.href)
  }, [pathname, counterId])

  return null
}
