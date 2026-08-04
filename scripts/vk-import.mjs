#!/usr/bin/env node
// Шаг 2 наполнения: залить отобранные посты из wall.json в сайт через ingest.
//
//   node scripts/vk-import.mjs <отбор.json> [--dry] [--draft]
//
// Требует в окружении (или web/.env):
//   SARAFAN_GATEWAY_KEY — ключ VK-шлюза Сарафана (доставка в ingest, X-Gateway-Key)
//   INGEST_PUBLISH_KEY  — право публиковать; без него всё уедет черновиками
//   INGEST_URL (опц.)   — адрес ingest, по умолчанию http://127.0.0.1:3006/api/ingest/posts
//
// Запускать ЛУЧШЕ НА ПРОД-БОКСЕ, где оба секрета уже лежат в
// /etc/kalinino/kalinino.env. См. AGENTS.md / docs/PUBLISHING.md.
//
// Формат файла отбора — массив объектов:
//   { "id": 1049, "section": "prazdniki", "sectionTitle": "Праздники и памятные даты",
//     "title": "…", "photos": [0,1,2,3], "videos": [0] }
//
// ⚠️ photos/videos перечисляются явными индексами вложений поста
// (в отфильтрованных списках типов) и никогда не «все подряд».

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OWNER_ID = Number(process.env.VK_OWNER_ID || -218991929)
const GATEWAY = 'https://3931b3fe50ab.vps.myjino.ru/api/gateway/call'
const ENDPOINT =
  process.env.INGEST_URL || 'http://127.0.0.1:3006/api/ingest/posts'

const DRY = process.argv.includes('--dry')
const FORCE_DRAFT = process.argv.includes('--draft')
const selectionPath = process.argv[2]
const wallPath = process.env.WALL_JSON || resolve(ROOT, 'scripts/.work/wall.json')

if (!selectionPath || selectionPath.startsWith('--')) {
  console.error('Укажите файл отбора: node scripts/vk-import.mjs отбор.json [--dry] [--draft]')
  process.exit(1)
}

const readEnvFile = (name) => {
  try {
    return readFileSync(resolve(ROOT, 'web/.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim()
  } catch {
    return undefined
  }
}

const gatewayKey = process.env.SARAFAN_GATEWAY_KEY || readEnvFile('SARAFAN_GATEWAY_KEY')
const publishKey = process.env.INGEST_PUBLISH_KEY || readEnvFile('INGEST_PUBLISH_KEY')
if (!gatewayKey) {
  console.error('Нет SARAFAN_GATEWAY_KEY (ни в окружении, ни в web/.env).')
  process.exit(1)
}
if (!publishKey) console.error('Нет INGEST_PUBLISH_KEY — посты уедут черновиками!')

const selection = JSON.parse(readFileSync(selectionPath, 'utf8'))
const wall = JSON.parse(readFileSync(wallPath, 'utf8')).response.items
const byId = new Map(wall.map((p) => [p.id, p]))

// Текст поста: ничего не переписываем, только снимаем обвязку — хэштеги и
// обратные ссылки [url|подпись]. Достоверность важнее гладкости.
const extractText = (raw) =>
  (raw || '')
    .replace(/\[https?:\/\/[^\]|]+\|[^\]]*\]/g, '')
    .replace(/#[^\s#]+/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

// player от VK API: https://vkvideo.ru/video_ext.php?oid=..&id=..&hash=..&__ref=..
// Для встраивания чистим до oid/id/hash (остальное — служебное и может протухать).
const normalizePlayer = (player) => {
  const m = player && player.match(/video_ext\.php\?(?:[^&]*&)*oid=([^&]+)&id=([^&]+)&hash=([^&]+)/)
  if (!m) return player
  return `https://vkvideo.ru/video_ext.php?oid=${m[1]}&id=${m[2]}&hash=${m[3]}`
}

// Достаём ссылки на плееры всех видео отобранных постов одним video.get (батч).
async function fetchPlayerUrls(selection, byId) {
  const ids = new Set()
  for (const item of selection) {
    const post = byId.get(item.id)
    if (!post) continue
    const videos = (post.attachments || []).filter((a) => a.type === 'video')
    for (const v of videos) ids.add(`${v.video.owner_id}_${v.video.id}`)
  }
  if (ids.size === 0) return new Map()
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': gatewayKey },
    body: JSON.stringify({ method: 'video.get', params: { videos: [...ids].join(',') } }),
  })
  if (!res.ok) {
    console.error(`video.get: HTTP ${res.status} — продолжаем без плееров (видео пропустим)`)
    return new Map()
  }
  const data = await res.json()
  if (!data.ok) {
    console.error('video.get:', JSON.stringify(data.error))
    return new Map()
  }
  const map = new Map()
  for (const v of data.response.items) {
    map.set(`${v.owner_id}_${v.id}`, normalizePlayer(v.player))
  }
  return map
}

const videoUrl = (v, players) => {
  const key = `${v.owner_id}_${v.id}`
  return players.get(key) || `https://vk.com/video${key}`
}

const pick = (list, indices, kind, id) =>
  (indices || []).map((i) => {
    if (!list[i]) throw new Error(`#${id}: ${kind} с индексом ${i} нет в посте`)
    return list[i]
  })

let ok = 0
let failed = 0

const players = DRY ? new Map() : await fetchPlayerUrls(selection, byId)

for (const item of selection) {
  const post = byId.get(item.id)
  if (!post) {
    console.error(`#${item.id}: нет в выгрузке — обновите wall.json`)
    failed++
    continue
  }

  const attachments = post.attachments || []
  const photos = attachments.filter((a) => a.type === 'photo')
  const videos = attachments.filter((a) => a.type === 'video')
  const iso = new Date(post.date * 1000).toISOString()

  let body
  try {
    body = {
      vkPostId: `${OWNER_ID}_${post.id}`,
      sourceUrl: `https://vk.com/wall${OWNER_ID}_${post.id}`,
      title: item.title,
      text: extractText(post.text),
      section: item.section,
      sectionTitle: item.sectionTitle,
      // Дата новости и дата публикации = дата оригинала. Без publishedAt хук
      // populatePublishedAt проставит «сегодня», и старая новость станет свежей.
      date: iso,
      publishedAt: iso,
      publish: !FORCE_DRAFT,
      images: pick(photos, item.photos, 'фото', post.id).map((p) => ({
        url: p.photo.sizes.at(-1).url,
        alt: item.title,
      })),
      videos: pick(videos, item.videos, 'видео', post.id).map((v) => ({
        url: videoUrl(v.video, players),
        title: v.video.title,
      })),
    }
  } catch (e) {
    console.error(`#${item.id}: ${e.message}`)
    failed++
    continue
  }

  if (DRY) {
    console.log(
      `#${post.id} → ${item.section} | ${iso.slice(0, 10)} | «${item.title}» | ` +
        `фото ${body.images.length}, видео ${body.videos.length}, текст ${body.text.length} симв.`,
    )
    continue
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gateway-Key': gatewayKey,
      'X-Publish-Key': publishKey || '',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))

  if (res.ok) {
    ok++
    const warn = (json.warnings || []).length ? ` | ⚠ ${JSON.stringify(json.warnings)}` : ''
    console.log(
      `#${post.id} → ${item.section} | HTTP ${res.status} | id=${json.id} | published=${json.published}${warn}`,
    )
  } else {
    failed++
    console.error(`#${post.id}: HTTP ${res.status} ${JSON.stringify(json)}`)
  }
}

console.log(`\nИтого: успешно ${ok}, ошибок ${failed}`)
if (failed) process.exitCode = 1
