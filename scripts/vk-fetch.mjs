#!/usr/bin/env node
// Шаг 1 наполнения: выгрузить свежие посты сообщества из ВК через шлюз SARAFAN.
//
//   SARAFAN_GATEWAY_KEY=… node scripts/vk-fetch.mjs [сколько] [файл]
//   по умолчанию: 50 постов в scripts/.work/wall.json
//
// Ключ читается из окружения или из web/.env (в репо не попадает, #008).
// Контракт шлюза — setka/docs/GATEWAY.md, канал описан в AGENTS.md.
// Запуск лучше с прод-бокса (локальная сеть до шлюза может резаться, G147).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATEWAY = 'https://3931b3fe50ab.vps.myjino.ru/api/gateway/call'

// «МКУК Калининская ЦКС» (screen_name kalinino_sdk, type=page).
export const OWNER_ID = Number(process.env.VK_OWNER_ID || -218991929)

const count = Number(process.argv[2] || 50)
const outPath = process.argv[3] || resolve(ROOT, 'scripts/.work/wall.json')

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

const key = process.env.SARAFAN_GATEWAY_KEY || readEnvFile('SARAFAN_GATEWAY_KEY')
if (!key) {
  console.error(
    'Нет SARAFAN_GATEWAY_KEY (ни в окружении, ни в web/.env).\n' +
      'Значение — GATEWAY_KEY_CDK_KALININO на боксе Сетки (в /etc/kalinino/kalinino.env).',
  )
  process.exit(1)
}

const res = await fetch(GATEWAY, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
  body: JSON.stringify({ method: 'wall.get', params: { owner_id: OWNER_ID, count } }),
})

if (res.status === 429) {
  console.error(`Шлюз просит подождать: ${res.headers.get('retry-after') || '?'} с (квота).`)
  process.exit(2)
}
if (!res.ok) {
  console.error(`Шлюз вернул HTTP ${res.status}. 401 — ключ неверен или отозван.`)
  process.exit(2)
}

const data = await res.json()
if (!data.ok) {
  console.error('VK вернул ошибку:', JSON.stringify(data.error))
  process.exit(2)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(data, null, 1))

const items = data.response.items
console.log(`Получено ${items.length} постов → ${outPath}\n`)

// Сводка для отбора: сюжеты внутри поста и типы вложений.
for (const p of items) {
  const parts = (p.text || '').split('✍').map((s) => s.trim())
  const segments = parts.length > 1 ? parts.slice(1) : [parts[0]]
  const att = {}
  for (const a of p.attachments || []) att[a.type] = (att[a.type] || 0) + 1
  const flag = segments.length > 1 ? ' ⚠СБОРНЫЙ' : ''
  console.log(
    `#${p.id} | ${new Date(p.date * 1000).toISOString().slice(0, 16).replace('T', ' ')} | ` +
      `сюжетов ${segments.length}${flag} | ${JSON.stringify(att)} | ` +
      `${segments[0].replace(/\s+/g, ' ').slice(0, 100)}`,
  )
}
