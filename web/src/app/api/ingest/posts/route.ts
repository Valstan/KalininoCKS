import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import config from '../../../../payload.config'
import {
  buildPostData,
  normalizeVideos,
  secretMatches,
  type IncomingVideo,
} from '../../../../lib/ingest'

// Ingest-эндпойнт импорта из ВК (задача владельца 02.08: сообщество kalinino_sdk
// через шлюз Сарафана #062). Скрипт scripts/vk-import.mjs забирает посты из шлюза
// и шлёт их сюда POST'ом; сайт в ВК сам НЕ ходит.
//
// Контракт: POST /api/ingest/posts, заголовок X-Gateway-Key (или Bearer), JSON:
// {
//   vkPostId:     string   — обязателен, ключ идемпотентности ("-218991929_1049")
//   sourceUrl:    string   — обязателен, ссылка на оригинал в ВК (атрибуция)
//   title?:       string   — если нет, берём начало текста
//   text?:        string   — plain text поста (абзацы через \n)
//   section?:     string   — slug рубрики; при отсутствии создаётся (sectionTitle)
//   sectionTitle?:string   — название рубрики для создания
//   date?:        string   — ISO-дата оригинального поста
//   images?:      Array<string | { url: string; alt?: string }> — медиа
//                            перекладываем к себе (ВК-CDN протухает, G56/G63)
//   videos?:      Array<string | { url: string; title?: string }> — видео НЕ
//                            перекладываем: ссылка на плеер ВК (mp4/video_ext.php),
//                            фронт рендерит их галереей-плеером
//   publishedAt?: string   — дата публикации (иначе хук проставит «сегодня»)
//   publish?:     boolean  — ЯВНАЯ публикация вместо draft, см. ниже
// }
//
// Поведение: по умолчанию draft. `publish: true` — осознанное действие оператора
// (наполнение силами сессии), требует ВТОРОГО секрета `INGEST_PUBLISH_KEY` в
// заголовке `X-Publish-Key` (#107): общий ключ шлюза доказывает, что предъявитель —
// «шлюз», и ничего не доказывает про право публиковать. Ключа нет или он неверен —
// пост всё равно создаётся, но черновиком, и в ответ идёт warning.
//
// ⚠️ G223: состояние документа берётся из `_status` в data, а НЕ из аргумента
// `draft` — см. buildPostData в lib/ingest.ts.
// Повторная доставка того же vkPostId не дублирует (G224: идемпотентность
// проверяем ДО перекладывания медиа) — draft обновляется, published не трогается.
// Рубрика при повторе не перезаписывается — она принадлежит редактору (#095).

type IncomingImage = string | { url: string; alt?: string }

const MAX_IMAGES = 10
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

// Право публиковать — отдельный секрет, не тот, которым авторизуется доставка.
const mayPublish = (request: Request): boolean =>
  secretMatches(request.headers.get('x-publish-key') ?? '', process.env.INGEST_PUBLISH_KEY)

const isAuthorized = (request: Request): boolean => {
  const given =
    request.headers.get('x-gateway-key') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    ''
  return secretMatches(given, process.env.SARAFAN_GATEWAY_KEY)
}

const extFromMime = (mime: string): string =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[mime] ??
  'jpg'

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.SARAFAN_GATEWAY_KEY) {
    return NextResponse.json({ error: 'ingest is not configured' }, { status: 503 })
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    vkPostId?: string
    sourceUrl?: string
    title?: string
    text?: string
    section?: string
    sectionTitle?: string
    date?: string
    images?: IncomingImage[]
    videos?: IncomingVideo[]
    publishedAt?: string
    publish?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const vkPostId = typeof body.vkPostId === 'string' ? body.vkPostId.trim() : ''
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const title =
    (typeof body.title === 'string' && body.title.trim()) ||
    (text ? `${text.slice(0, 80)}${text.length > 80 ? '…' : ''}` : '')

  if (!vkPostId) return NextResponse.json({ error: 'vkPostId is required' }, { status: 400 })
  if (!sourceUrl) return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title or text is required' }, { status: 400 })

  const payload = await getPayload({ config })
  const warnings: string[] = []
  let publish = body.publish === true
  if (publish && !mayPublish(request)) {
    publish = false
    warnings.push('publish ignored: valid X-Publish-Key required, saved as draft')
  }
  const videos = normalizeVideos(body.videos, warnings)

  // Рубрика по slug от скрипта импорта. Неизвестного slug — создаём рубрику
  // (словарь рубрик живёт в скрипте, поэтому список не разрастается мусором);
  // при повторной доставке рубрику НЕ перезаписываем (#095) — она принадлежит
  // редактору, пустую дозаполнить можно.
  let categoryId: number | undefined
  if (typeof body.section === 'string' && body.section.trim()) {
    const slug = body.section.trim()
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (found.docs[0]) {
      categoryId = found.docs[0].id
    } else {
      const title = (body.sectionTitle || slug).trim().slice(0, 80)
      const created = await payload.create({ collection: 'categories', data: { title, slug } })
      categoryId = created.id
      warnings.push(`category created: ${slug}`)
    }
  }

  // Идемпотентность по VK post-id: повторная доставка не создаёт дубль
  // (проверка ДО перекладывания медиа, G224).
  const existing = await payload.find({
    collection: 'posts',
    where: { vkPostId: { equals: vkPostId } },
    draft: true,
    limit: 1,
  })
  const existingPost = existing.docs[0]

  if (existingPost && existingPost._status === 'published') {
    // Опубликованное руками не перетираем автоматикой.
    return NextResponse.json(
      { created: false, updated: false, id: existingPost.id, warnings },
      { status: 200 },
    )
  }

  // Медиа перекладываем к себе (не храним ВК-CDN-ссылки как основные).
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []
  if (Array.isArray(body.images) && body.images.length > MAX_IMAGES) {
    warnings.push(`images truncated to ${MAX_IMAGES}`)
  }
  const mediaIds: number[] = []
  for (const [index, image] of images.entries()) {
    const url = typeof image === 'string' ? image : image?.url
    const alt = typeof image === 'object' && image?.alt ? image.alt : title
    if (!url || !/^https?:\/\//i.test(url)) {
      warnings.push(`image ${index}: invalid url`)
      continue
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
      if (!mime.startsWith('image/')) throw new Error(`not an image: ${mime}`)
      const data = Buffer.from(await response.arrayBuffer())
      if (data.length > MAX_IMAGE_BYTES) throw new Error(`too large: ${data.length} bytes`)
      const media = await payload.create({
        collection: 'media',
        data: { alt },
        file: {
          data,
          mimetype: mime,
          name: `vk-${vkPostId.replace(/[^\w-]/g, '_')}-${index}.${extFromMime(mime)}`,
          size: data.length,
        },
      })
      mediaIds.push(media.id)
    } catch (error) {
      warnings.push(`image ${index}: ${error instanceof Error ? error.message : 'fetch failed'}`)
    }
  }

  const data = buildPostData({
    title,
    text,
    vkPostId,
    sourceUrl,
    publish,
    videos,
    mediaIds,
    date: body.date,
    publishedAt: body.publishedAt,
    categoryId,
  })

  if (existingPost) {
    // Draft уже есть — обновляем содержимое, медиа при повторе не дублируем:
    // новые файлы заменяют список целиком. Рубрику не перезаписываем (#095).
    const updated = await payload.update({
      collection: 'posts',
      id: existingPost.id,
      data: {
        ...data,
        category: existingPost.category ? undefined : categoryId,
        ...(mediaIds.length ? {} : { cover: undefined, gallery: undefined }),
      },
      draft: !publish,
    })
    return NextResponse.json(
      { created: false, updated: true, published: publish, id: updated.id, warnings },
      { status: 200 },
    )
  }

  const created = await payload.create({
    collection: 'posts',
    data,
    draft: !publish,
  })
  return NextResponse.json(
    { created: true, published: publish, id: created.id, warnings },
    { status: 201 },
  )
}
