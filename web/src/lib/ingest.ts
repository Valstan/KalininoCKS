import { timingSafeEqual } from 'crypto'

// Чистая логика ingest-конвейера импорта из ВК (web/src/app/api/ingest/posts/route.ts).
// Вынесена из route.ts, чтобы её можно было проверить тестами без БД и HTTP.
//
// Грабля G223 (находка портала вМалмыже 2026-08-03): при versions.drafts: true
// Payload берёт состояние документа из `data._status`, а НЕ из аргумента `draft`.
// `draft: false` без `_status: 'published'` создаёт черновик — молча.

export type LexNode = { [k: string]: unknown; type: string; version: number }

export const textNode = (text: string): LexNode => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

export const paragraph = (children: LexNode[]): LexNode => ({
  type: 'paragraph',
  direction: null,
  format: '' as const,
  indent: 0,
  version: 1,
  children,
})

// Плейн-текст → минимальный lexical richText (абзац на непустую строку).
// Видео в тексте НЕ дублируем: они живут в массиве `videos` поста и рендерятся
// галереей (mp4 — нативный плеер, video_ext.php — iframe ВК).
export const buildContent = (text: string) => {
  const children: LexNode[] = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => paragraph([textNode(line)]))

  return {
    root: {
      type: 'root',
      direction: null,
      format: '' as const,
      indent: 0,
      version: 1,
      children,
    },
  }
}

export type IncomingVideo = string | { url: string; title?: string }

export const MAX_VIDEOS = 5

// Видео приходят ссылками на плеер ВК — нормализуем и отбрасываем мусор.
export const normalizeVideos = (
  raw: unknown,
  warnings: string[],
): { url: string; title?: string }[] => {
  if (!Array.isArray(raw)) return []
  const videos: { url: string; title?: string }[] = []
  for (const [index, item] of (raw as IncomingVideo[]).entries()) {
    if (videos.length >= MAX_VIDEOS) {
      warnings.push(`videos truncated to ${MAX_VIDEOS}`)
      break
    }
    const url = typeof item === 'string' ? item : item?.url
    if (!url || !/^https?:\/\//i.test(url)) {
      warnings.push(`video ${index}: invalid url`)
      continue
    }
    videos.push({ url, title: typeof item === 'object' ? item?.title : undefined })
  }
  return videos
}

// Constant-time сравнение секрета из заголовка с ожидаемым.
export const secretMatches = (given: string, expected: string | undefined): boolean => {
  if (!expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type PostDataInput = {
  title: string
  text: string
  vkPostId: string
  sourceUrl: string
  publish: boolean
  videos: { url: string; title?: string }[]
  mediaIds: number[]
  date?: string
  publishedAt?: string
  categoryId?: number
}

// Тело документа для payload.create/update.
//
// ⚠️ `_status` здесь не украшение: при включённых versions.drafts Payload берёт
// состояние документа именно отсюда, а аргумент `draft` сам по себе НЕ
// публикует (G223). Без этой строки пост молча остаётся черновиком при HTTP 201.
export const buildPostData = (input: PostDataInput) => ({
  ...(input.publish ? { _status: 'published' as const } : {}),
  title: input.title,
  date: input.date || undefined,
  // Дата публикации = дата оригинала, если её прислали: иначе хук
  // populatePublishedAt проставит «сегодня», и старая новость выглядела бы свежей.
  publishedAt: input.publishedAt || input.date || undefined,
  category: input.categoryId,
  content: input.text ? buildContent(input.text) : undefined,
  cover: input.mediaIds[0],
  gallery: input.mediaIds.length ? input.mediaIds : undefined,
  videos: input.videos.length ? input.videos : undefined,
  vkPostId: input.vkPostId,
  sourceUrl: input.sourceUrl,
})
