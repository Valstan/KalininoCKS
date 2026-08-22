/**
 * Чистая логика автоимпорта постов из ВК: отбор, очистка, рубрикация, заголовок.
 *
 * Всё, что здесь лежит, не ходит в сеть и не знает про Payload — поэтому проверяется
 * тестами на реальной выгрузке сообщества (`web/tests/fixtures/vk-posts.json`,
 * 29 постов с ручной разметкой владельца). Сетевая часть — в `app/api/vk-sync/run`.
 */

/** Рубрики берём фиксированным списком: сам ingest создаёт неизвестный slug молча,
 *  и опечатка расплодила бы мусорные рубрики (#095 про то, кому принадлежит рубрика). */
export const SECTIONS = {
  prazdniki: 'Праздники и памятные даты',
  koncerty: 'Концерты и выступления',
  akcii: 'Акции и сборы',
  dostizheniya: 'Награды и достижения',
  novosti: 'Новости',
} as const

export type SectionSlug = keyof typeof SECTIONS

export type VkAttachment = {
  type: string
  photo?: { sizes?: { url: string; width?: number; height?: number }[] }
  video?: { owner_id: number; id: number; title?: string; player?: string }
}

export type VkPost = {
  id: number
  date: number
  text?: string
  marked_as_ads?: number
  is_pinned?: number
  copy_history?: unknown[]
  attachments?: VkAttachment[]
}

/**
 * Самый большой размер фото, а не последний в массиве.
 *
 * В скрипте ручного импорта стояло `sizes.at(-1)` — ВК обычно отдаёт размеры по
 * возрастанию, поэтому это работало «случайно». Порядок ничем не гарантирован:
 * один ответ с другим порядком — и на сайт уезжает превью 130 px вместо оригинала.
 */
export const pickLargestPhoto = (
  sizes: { url: string; width?: number; height?: number }[] | undefined,
): string | undefined => {
  if (!sizes?.length) return undefined
  let best = sizes[0]
  let bestArea = (best.width ?? 0) * (best.height ?? 0)
  for (const size of sizes) {
    const area = (size.width ?? 0) * (size.height ?? 0)
    if (area > bestArea) {
      best = size
      bestArea = area
    }
  }
  return best.url
}

/** Хэштеги нужны рубрикатору, а из текста они убираются — поэтому снимаем их ДО очистки. */
export const extractHashtags = (raw: string): string[] =>
  [...(raw || '').matchAll(/#([^\s#@]+)/g)].map((m) => m[1].toLowerCase())

/**
 * Снимаем обвязку ВК, не переписывая текст: достоверность важнее гладкости.
 * `[club123|Название]` и `[id45|Имя]` — упоминания, у которых на сайте нет адресата;
 * оставляем видимую подпись, а не ссылку.
 */
export const stripVkMarkup = (raw: string): string =>
  (raw || '')
    .replace(/\[(?:club|public|id)\d+\|([^\]]*)\]/g, '$1')
    .replace(/\[https?:\/\/[^\]|]+\|([^\]]*)\]/g, '$1')
    .replace(/#[^\s#]+/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

export type SkipReason = 'repost' | 'ad' | 'empty'

/**
 * Что не берём вовсе:
 *  - репосты (`copy_history`) — чужой контент, атрибуция и медиа принадлежат другому сообществу;
 *  - рекламные записи;
 *  - записи, где нет ни текста, ни фото, ни видео (в ленте таких хватает — опросы, служебные).
 *
 * Пост «одна афиша без текста» НЕ отбрасываем: у сельского клуба это нормальная новость,
 * и заголовок для неё собирается из даты. Решение о судьбе такого поста принимает
 * человек в админке — он всё равно приезжает черновиком.
 */
export const skipReason = (post: VkPost): SkipReason | null => {
  if (post.copy_history?.length) return 'repost'
  if (post.marked_as_ads) return 'ad'
  const hasText = Boolean((post.text || '').trim())
  const media = (post.attachments || []).filter((a) => a.type === 'photo' || a.type === 'video')
  if (!hasText && media.length === 0) return 'empty'
  return null
}

const RULES: { section: SectionSlug; patterns: RegExp[] }[] = [
  // Награды сильнее всего: «с победой на фестивале» — это достижение, даже если там был концерт.
  {
    section: 'dostizheniya',
    patterns: [
      // «Победы в Калинино» — это День Победы, а не победа в конкурсе: требуем контекст состязания.
      /побед[а-яё]*\s+(?:на|в)\s+(?:фестивал|конкурс|олимпиад|соревнован|смотр|состязан)/i,
      /поздравляем[^.]{0,120}с\s+побед/i,
      /лауреат|дипломант|гран-при|призов[оы]|заняли?\s+\w+\s+место|\bI{1,3}\s+место|1-е\s+место/i,
      /выставка\s+(?:юных\s+)?(?:художник|работ|рисунк)/i,
    ],
  },
  // Сборы и акции — действие, а не выступление. Морфология важна: «сбора подарков».
  {
    section: 'akcii',
    patterns: [
      /сбор[а-яё]*\s+(?:подарк|помощ|гуманитар|средств|вещей)/i,
      /\bакци[яию]\b/i,
      /минут[аы]\s+молчания/i,
      /субботник/i,
    ],
  },
  // Праздник как СОБЫТИЕ (митинг, шествие, открытие доски, фестиваль).
  {
    section: 'prazdniki',
    patterns: [
      /митинг|бессмертный\s+полк|шеств[иеи]|возложени[ею]|мемориальн[аоы]/i,
      /сабантуй|курбан|питрау|масленица|пасх[аи]|новый\s+год|рождеств/i,
      /дн[еёя][а-яё]*\s+(?:велик\w+\s+)?(?:побед|росси|семьи|пограничник|защитник|народного\s+единства|знаний|пожилых|матери)/i,
      /фестиваль/i,
    ],
  },
  // Концерты и выезды коллективов.
  {
    section: 'koncerty',
    patterns: [
      /концерт|гала-концерт|выступ(?:ил|или|ление|ления)|смотр\s+песни|конкурсн[аоы]я?\s+программ/i,
      /артист[ыао]\s+/i,
    ],
  },
]

/**
 * Хэштеги сообщества оказались сигналом надёжнее текста: посты помечены
 * `#ДеньПобеды`, `#сабантуй2026`, `#Питрау`, `#Сборподарковнасабантуй`. Сравниваем
 * по нормализованной форме (только буквы, нижний регистр) — в ленте встречается и
 * `#ДеньСемьиЛюбвииВерности`, и `#деньсемьи`.
 */
const HASHTAG_HINTS: { section: SectionSlug; needles: string[] }[] = [
  { section: 'akcii', needles: ['сборподарков', 'сбор', 'акция', 'минутамолчания'] },
  {
    section: 'prazdniki',
    needles: [
      'деньпобеды',
      'деньроссии',
      'деньсемьи',
      'деньпограничника',
      'деньзащитника',
      'сабантуй',
      'питрау',
      'курбан',
      'масленица',
      'бессмертныйполк',
      '9мая',
    ],
  },
]

const normalizeTag = (tag: string): string => tag.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')

/**
 * Правило разрешения главного конфликта, увиденное в ручной разметке владельца:
 * «Гала-концерт ко Дню Победы» размечен как КОНЦЕРТЫ, а «День пограничника: митинг
 * и праздничный концерт» — как ПРАЗДНИКИ. Разница в том, чем пост является по сути:
 * выступлением коллектива или праздничным событием села. Признак выезда («выступили
 * в/на», «артисты ДК на…») перевешивает праздничные слова.
 */
const LOOKS_LIKE_TRIP = /выступ[а-яё]*[^.]{0,60}?\s(?:на|в)\s|артист[а-яё]*[^.]{0,30}?выступ/i

export type Classification = { section: SectionSlug; confident: boolean; reason: string }

/**
 * Рубрика по тексту и хэштегам. Это ПОДСКАЗКА, а не решение: разметка владельца
 * различает «праздник» и «концерт» по смыслу, поэтому словарь принципиально не может
 * быть точным. Поэтому у результата есть `confident` — по нему видно, когда стоит
 * позвать человека (а он и так смотрит: посты приезжают черновиками).
 */
export const classify = (rawText: string): Classification => {
  const tags = extractHashtags(rawText).map(normalizeTag)
  const text = stripVkMarkup(rawText)

  const tagHint = HASHTAG_HINTS.find((hint) =>
    tags.some((tag) => hint.needles.some((needle) => tag.includes(needle))),
  )?.section

  // Тема поста живёт в начале: «спасибо за помощь в сборе подарков» в конце благодарности
  // не делает пост акцией. Правила проверяем по «голове» текста, а не по всему полотну.
  const head = text.slice(0, 220)
  const hits = RULES.filter((rule) => rule.patterns.some((re) => re.test(head)))
  const byText = (slug: SectionSlug) => hits.some((h) => h.section === slug)

  // Награда и сбор — это про суть события, они перебивают и хэштег праздника:
  // «Сбор подарков на сабантуй» помечен #сабантуй, но это акция, а не праздник.
  if (byText('dostizheniya')) return { section: 'dostizheniya', confident: true, reason: 'награда' }
  if (byText('akcii') || tagHint === 'akcii')
    return { section: 'akcii', confident: true, reason: 'сбор или акция' }

  // Праздничный хэштег — сильный сигнал, но выезд коллектива его перебивает:
  // «Артисты ДК выступили на празднике „Питрау“» размечено владельцем как концерты.
  if (tagHint === 'prazdniki') {
    return LOOKS_LIKE_TRIP.test(text)
      ? { section: 'koncerty', confident: false, reason: 'праздничный хэштег + выезд коллектива' }
      : { section: 'prazdniki', confident: true, reason: 'праздничный хэштег' }
  }

  if (hits.length === 0) return { section: 'novosti', confident: false, reason: 'совпадений нет' }

  // Тот же конфликт, но когда хэштегов нет и оба правила сработали по тексту.
  if (byText('prazdniki') && byText('koncerty')) {
    return LOOKS_LIKE_TRIP.test(text)
      ? { section: 'koncerty', confident: false, reason: 'праздник + признак выезда коллектива' }
      : { section: 'prazdniki', confident: false, reason: 'праздник + концерт на месте' }
  }

  return {
    section: hits[0].section,
    confident: hits.length === 1,
    reason: hits.length === 1 ? 'одно правило' : `несколько правил: ${hits.map((h) => h.section).join(', ')}`,
  }
}

/**
 * Заголовок из текста поста: первая осмысленная строка, обрезанная по границе слова.
 * Пустой текст (афиша одной картинкой) — заголовок из даты, иначе ingest отказал бы:
 * ему нужен либо title, либо text.
 */
export const buildTitle = (rawText: string, postDateMs: number): string => {
  const text = stripVkMarkup(rawText)
  const firstLine = text.split('\n')[0] || ''
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] || firstLine

  if (!sentence) {
    const date = new Date(postDateMs).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `Новость от ${date}`
  }

  if (sentence.length <= 90) return sentence.replace(/[.\s]+$/, '')

  const cut = sentence.slice(0, 90)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : 90).replace(/[.,\s]+$/, '')}…`
}

/**
 * Ссылка на плеер ВК: чистим до oid/id/hash. Остальные параметры служебные и протухают,
 * а нам этот URL лежать в БД долго.
 */
export const normalizePlayer = (player: string | undefined): string | undefined => {
  const match = player?.match(/video_ext\.php\?(?:[^&]*&)*oid=([^&]+)&id=([^&]+)&hash=([^&]+)/)
  return match ? `https://vkvideo.ru/video_ext.php?oid=${match[1]}&id=${match[2]}&hash=${match[3]}` : player
}
