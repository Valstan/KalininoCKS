import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { secretMatches } from '../../../../lib/ingest'
import {
  buildTitle,
  classify,
  normalizePlayer,
  pickLargestPhoto,
  SECTIONS,
  skipReason,
  stripVkMarkup,
  type VkPost,
} from '../../../../lib/vk-sync'

/**
 * Автоимпорт постов сообщества ВК: временный мотор до подключения конвейера Сарафана (D-015).
 *
 * Почему мотор у нас, а не в Сарафане: конвейер по D-015 — их модуль, но наше сообщество
 * у них даже не заведено в мониторинг, сроков нет, а сайт всё это время наполняется руками.
 * Схема выбрана так, чтобы её было НЕ ЖАЛКО ВЫБРОСИТЬ: точка приёма — тот же самый
 * `POST /api/ingest/posts`, что и у конвейера. Придёт Сарафан — гасим `VK_SYNC_ENABLED`
 * и удаляем этот файл, приёмник и данные остаются на месте.
 *
 * Как работает: таймер на сервере раз в сутки дёргает этот роут по 127.0.0.1 (наружу он
 * не открыт, см. nginx). Роут читает стену через шлюз Сарафана — сайт в ВК сам не ходит
 * (VK-токены привязаны к IP шлюза, #062) — отбирает те посты, которых ещё нет в базе,
 * и отправляет их в собственный ingest.
 *
 * ⚠️ Публикация выключена по умолчанию: без `VK_SYNC_PUBLISH=1` посты приезжают
 * ЧЕРНОВИКАМИ в админку. Это осознанный режим на первые недели — рубрикатор угадывает
 * 27 из 29 на реальной разметке владельца, а оставшееся различается по смыслу, а не по
 * словам. Человек правит рубрику в `/admin`, и ingest её больше не перезаписывает (#095).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Адрес шлюза Сарафана. Литерала в репозитории нет намеренно (AGENTS.md
 * §🛡 Публичный репозиторий): значение живёт в env-файле сервиса. Не задано —
 * роут отвечает 503, как и без ключа шлюза, а не ходит в никуда.
 */
const GATEWAY = process.env.SARAFAN_GATEWAY_URL || ''
const OWNER_ID = Number(process.env.VK_OWNER_ID || -218991929)

/** Сколько записей стены смотрим за прогон. Больше 50 ВК за раз не отдаёт. */
const FETCH_COUNT = Number(process.env.VK_SYNC_FETCH_COUNT || 30)

/** Сколько постов за прогон реально импортируем: медиа тяжёлые, торопиться некуда. */
const IMPORT_LIMIT = Number(process.env.VK_SYNC_LIMIT || 5)

/** Локальный адрес собственного ingest: наружу этот путь не выставлен и не должен быть. */
const INGEST_URL = process.env.INGEST_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/ingest/posts`

/** Один прогон за раз на процесс: таймер и ручной запуск не должны наложиться. */
let running = false

type GatewayResult<T> = { ok?: boolean; response?: T; error?: unknown }

const callGateway = async <T,>(method: string, params: Record<string, unknown>, key: string) => {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ method, params }),
  })
  if (!res.ok) throw new Error(`шлюз ${method}: HTTP ${res.status}`)
  const data = (await res.json()) as GatewayResult<T>
  if (data.ok === false || !data.response) throw new Error(`шлюз ${method}: ${JSON.stringify(data.error)}`)
  return data.response
}

/** Ссылки на плееры всех видео отобранных постов — одним запросом, а не по одному. */
const fetchPlayers = async (posts: VkPost[], key: string): Promise<Map<string, string>> => {
  const ids = new Set<string>()
  for (const post of posts) {
    for (const att of post.attachments || []) {
      if (att.type === 'video' && att.video) ids.add(`${att.video.owner_id}_${att.video.id}`)
    }
  }
  if (!ids.size) return new Map()
  try {
    const response = await callGateway<{ items: { owner_id: number; id: number; player?: string }[] }>(
      'video.get',
      { videos: [...ids].join(',') },
      key,
    )
    return new Map(
      response.items.map((v) => [`${v.owner_id}_${v.id}`, normalizePlayer(v.player) || `https://vk.com/video${v.owner_id}_${v.id}`]),
    )
  } catch {
    // Видео — не повод ронять весь прогон: без плееров пост уедет с фото и текстом.
    return new Map()
  }
}

const authorized = (request: Request): boolean =>
  secretMatches(
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      request.headers.get('x-vk-sync-key') ??
      '',
    process.env.VK_SYNC_SECRET,
  )

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (process.env.VK_SYNC_ENABLED !== '1') {
    return NextResponse.json({ enabled: false, hint: 'VK_SYNC_ENABLED=1 включает автоимпорт' }, { status: 503 })
  }

  const gatewayKey = process.env.SARAFAN_GATEWAY_KEY
  if (!gatewayKey) return NextResponse.json({ error: 'SARAFAN_GATEWAY_KEY не задан' }, { status: 503 })
  if (!GATEWAY) return NextResponse.json({ error: 'SARAFAN_GATEWAY_URL не задан' }, { status: 503 })

  if (running) return NextResponse.json({ error: 'прогон уже идёт' }, { status: 409 })
  running = true

  const params = new URL(request.url).searchParams
  const dry = params.get('dry') === '1'
  /**
   * `?refresh=1` — прогнать заново и те посты, что уже в базе. Нужен, когда изменились
   * правила разбора: ingest обновит ЧЕРНОВИК и не тронет опубликованное, а пустую
   * рубрику дозаполнит (#095). В обычном прогоне известные посты пропускаются.
   */
  const refresh = params.get('refresh') === '1'
  const started = Date.now()

  try {
    const wall = await callGateway<{ items: VkPost[] }>(
      'wall.get',
      { owner_id: OWNER_ID, count: FETCH_COUNT },
      gatewayKey,
    )

    // Афиши (картинка без текста) берём: решение владельца 22.08 — это анонсы
    // мероприятий, ради которых на сайт и заходят. Отключается VK_SYNC_SKIP_POSTERS=1.
    const takePosters = process.env.VK_SYNC_SKIP_POSTERS !== '1'
    const skipped: Record<string, number> = {}
    const candidates = wall.items.filter((post) => {
      const reason = skipReason(post, takePosters)
      if (reason) skipped[reason] = (skipped[reason] || 0) + 1
      return !reason
    })

    // Что уже есть в базе — спрашиваем у самой базы, а не у файла состояния:
    // vkPostId уникален, и это единственный носитель правды, переживающий деплой.
    const payload = await getPayload({ config })
    const ids = candidates.map((post) => `${OWNER_ID}_${post.id}`)
    const existing = ids.length
      ? await payload.find({
          collection: 'posts',
          where: { vkPostId: { in: ids } },
          depth: 0,
          limit: ids.length,
          pagination: false,
        })
      : { docs: [] as { vkPostId?: string | null }[] }
    const known = new Set(existing.docs.map((doc) => doc.vkPostId).filter(Boolean) as string[])

    // Самые старые сначала: иначе при лимите за прогон хвост ленты никогда не доедет.
    const fresh = candidates
      .filter((post) => refresh || !known.has(`${OWNER_ID}_${post.id}`))
      .sort((a, b) => a.date - b.date)
      .slice(0, IMPORT_LIMIT)

    const publish = process.env.VK_SYNC_PUBLISH === '1'
    const players = dry ? new Map<string, string>() : await fetchPlayers(fresh, gatewayKey)

    const results: Record<string, unknown>[] = []

    for (const post of fresh) {
      const vkPostId = `${OWNER_ID}_${post.id}`
      const iso = new Date(post.date * 1000).toISOString()
      const guess = classify(post.text || '')
      const attachments = post.attachments || []

      const body = {
        vkPostId,
        sourceUrl: `https://vk.com/wall${vkPostId}`,
        title: buildTitle(post.text || '', post.date * 1000),
        text: stripVkMarkup(post.text || ''),
        section: guess.section,
        sectionTitle: SECTIONS[guess.section],
        date: iso,
        publishedAt: iso,
        publish,
        images: attachments
          .filter((att) => att.type === 'photo')
          .map((att) => pickLargestPhoto(att.photo?.sizes))
          .filter((url): url is string => Boolean(url))
          .map((url) => ({ url })),
        videos: attachments
          .filter((att) => att.type === 'video' && att.video)
          .map((att) => ({
            url: players.get(`${att.video!.owner_id}_${att.video!.id}`) || `https://vk.com/video${att.video!.owner_id}_${att.video!.id}`,
            title: att.video!.title,
          })),
      }

      if (dry) {
        results.push({
          vkPostId,
          dry: true,
          title: body.title,
          section: `${guess.section} (${guess.reason})`,
          images: body.images.length,
          videos: body.videos.length,
        })
        continue
      }

      try {
        const res = await fetch(INGEST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Key': gatewayKey,
            ...(publish ? { 'X-Publish-Key': process.env.INGEST_PUBLISH_KEY || '' } : {}),
          },
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify(body),
        })
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
        results.push({
          vkPostId,
          status: res.status,
          id: json.id,
          published: json.published,
          section: guess.section,
          confident: guess.confident,
          warnings: json.warnings,
        })
      } catch (error) {
        // Один упавший пост не отменяет остальные: он просто не попадёт в базу и
        // будет заново подхвачен следующим прогоном — идемпотентность по vkPostId.
        results.push({ vkPostId, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const failed = results.filter((r) => r.error || (typeof r.status === 'number' && r.status >= 400)).length

    return NextResponse.json({
      ok: failed === 0,
      dry,
      refresh,
      publish,
      takePosters,
      tookMs: Date.now() - started,
      seen: wall.items.length,
      skipped,
      alreadyKnown: known.size,
      picked: fresh.length,
      failed,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    )
  } finally {
    running = false
  }
}
