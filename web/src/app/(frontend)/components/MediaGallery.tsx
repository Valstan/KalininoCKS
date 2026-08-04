'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type GalleryItem =
  | {
      type: 'image'
      src: string
      alt?: string | null
      thumb?: string | null
    }
  | {
      type: 'video'
      src: string
      title?: string | null
    }

// Галерея медиа: сетка превью, клик по элементу открывает лайтбокс
// с пролистыванием (←/→, свайп, счётчик). Видео: mp4 — нативный плеер,
// ссылка vk.com/video_ext.php — встраиваемый iframe.
export function MediaGallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<number | null>(null)
  const touchX = useRef<number | null>(null)

  const close = useCallback(() => setActive(null), [])
  const step = useCallback(
    (dir: 1 | -1) =>
      setActive((cur) => (cur === null ? cur : (cur + dir + items.length) % items.length)),
    [items.length],
  )

  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, close, step])

  if (items.length === 0) return null

  return (
    <>
      <div className="gallery">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className="gallery__thumb"
            onClick={() => setActive(i)}
            aria-label={item.type === 'image' ? (item.alt ?? 'Фото из поста') : (item.title ?? 'Видео из поста')}
          >
            {item.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- превью в галерее, не обложка страницы
              <img src={item.thumb || item.src} alt={item.alt ?? ''} loading="lazy" />
            ) : (
              <span className="gallery__video-tag">▶</span>
            )}
          </button>
        ))}
      </div>

      {active !== null ? (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <button type="button" className="lightbox__close" onClick={close} aria-label="Закрыть">
            ✕
          </button>
          <div
            className="lightbox__stage"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current
              if (Math.abs(dx) > 40) step(dx > 0 ? -1 : 1)
              touchX.current = null
            }}
          >
            {items[active].type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- полноразмерное фото в лайтбоксе
              <img src={items[active].src} alt={items[active].alt ?? ''} />
            ) : isVkPlayer(items[active].src) ? (
              <iframe
                src={items[active].src}
                title={items[active].title ?? 'Видео из поста'}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- служебный плеер галереи
              <video src={items[active].src} controls />
            )}
            <div className="lightbox__caption">
              {items[active].type === 'image'
                ? (items[active].alt ?? '')
                : (items[active].title ?? '')}
            </div>
          </div>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev"
            onClick={(e) => {
              e.stopPropagation()
              step(-1)
            }}
            aria-label="Предыдущий"
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next"
            onClick={(e) => {
              e.stopPropagation()
              step(1)
            }}
            aria-label="Следующий"
          >
            ›
          </button>
          <div className="lightbox__counter">
            {active + 1} / {items.length}
          </div>
        </div>
      ) : null}
    </>
  )
}

function isVkPlayer(url: string): boolean {
  return (
    url.includes('vk.com/video_ext.php') ||
    url.includes('vk.ru/video_ext.php') ||
    url.includes('vkvideo.ru/video_ext.php')
  )
}
