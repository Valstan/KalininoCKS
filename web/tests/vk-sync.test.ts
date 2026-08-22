import { describe, expect, it } from 'vitest'

import fixture from './fixtures/vk-posts.json'
import {
  buildTitle,
  classify,
  normalizePlayer,
  pickLargestPhoto,
  SECTIONS,
  skipReason,
  stripVkMarkup,
  type SectionSlug,
} from '../src/lib/vk-sync'

// Фикстура — те самые 29 постов сообщества, которые владелец разложил по рубрикам
// руками при первом наполнении. Это единственная имеющаяся у нас эталонная разметка.
const posts = fixture as { id: number; text: string; expected: SectionSlug; manualTitle: string }[]

describe('pickLargestPhoto', () => {
  it('берёт самый большой размер, а не последний в массиве', () => {
    const url = pickLargestPhoto([
      { url: 'big', width: 1280, height: 960 },
      { url: 'small', width: 130, height: 98 },
    ])
    expect(url).toBe('big')
  })

  it('переживает размеры без ширины и пустой список', () => {
    expect(pickLargestPhoto([{ url: 'only' }])).toBe('only')
    expect(pickLargestPhoto([])).toBeUndefined()
    expect(pickLargestPhoto(undefined)).toBeUndefined()
  })
})

describe('stripVkMarkup', () => {
  it('оставляет подпись упоминания, а не ссылку', () => {
    expect(stripVkMarkup('Спасибо [club218991929|Калининскому ДК] за праздник')).toBe(
      'Спасибо Калининскому ДК за праздник',
    )
  })

  it('снимает хэштеги и схлопывает пустые строки', () => {
    expect(stripVkMarkup('Концерт\n\n\n#калинино #дк')).toBe('Концерт')
  })
})

describe('skipReason', () => {
  it('отбрасывает репосты, рекламу и совсем пустые записи', () => {
    expect(skipReason({ id: 1, date: 0, copy_history: [{}] })).toBe('repost')
    expect(skipReason({ id: 2, date: 0, text: 'текст', marked_as_ads: 1 })).toBe('ad')
    expect(skipReason({ id: 3, date: 0, text: '   ' })).toBe('empty')
  })

  it('по умолчанию отсеивает афишу — картинку без единого слова текста', () => {
    // Заголовок для неё взять неоткуда: вышло бы «Новость от 11 июня». Именно это
    // показал сухой прогон на живой ленте, и именно это владелец отсеивал руками.
    expect(skipReason({ id: 4, date: 0, attachments: [{ type: 'photo' }] })).toBe('poster')
  })

  it('берёт афишу, если её явно попросили', () => {
    expect(skipReason({ id: 4, date: 0, attachments: [{ type: 'photo' }] }, true)).toBeNull()
  })

  it('пост с текстом и фото берёт всегда', () => {
    expect(skipReason({ id: 5, date: 0, text: 'Концерт', attachments: [{ type: 'photo' }] })).toBeNull()
  })
})

describe('buildTitle', () => {
  it('берёт первое предложение', () => {
    expect(buildTitle('Прошёл концерт. Было много гостей.', 0)).toBe('Прошёл концерт')
  })

  it('режет длинную строку по границе слова', () => {
    const title = buildTitle('А'.repeat(30) + ' ' + 'Б'.repeat(120), 0)
    expect(title.length).toBeLessThanOrEqual(91)
    expect(title.endsWith('…')).toBe(true)
  })

  it('для афиши без текста собирает заголовок из даты', () => {
    expect(buildTitle('', Date.UTC(2026, 7, 22))).toBe('Новость от 22 августа 2026 г.')
  })
})

describe('normalizePlayer', () => {
  it('оставляет только oid/id/hash', () => {
    expect(
      normalizePlayer('https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abc&__ref=wall&hd=2'),
    ).toBe('https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abc')
  })
})

describe('classify — на реальной разметке владельца', () => {
  it('фикстура не потерялась', () => {
    expect(posts.length).toBe(29)
  })

  it('никогда не выдумывает рубрику вне списка сайта', () => {
    for (const post of posts) {
      expect(Object.keys(SECTIONS)).toContain(classify(post.text).section)
    }
  })

  // Порог намеренно скромный: разметка владельца различает «праздник» и «концерт»
  // по смыслу события, а не по словам («Гала-концерт ко Дню Победы» — концерты,
  // «День пограничника: митинг и концерт» — праздники). Словарь такое не решает,
  // поэтому посты и приезжают черновиками. Тест фиксирует, что подсказка полезна
  // (лучше, чем «всё в Новости»), и ловит регрессию, если правила поедут.
  it('угадывает не хуже установленного порога', () => {
    const hits = posts.filter((post) => classify(post.text).section === post.expected)
    const share = hits.length / posts.length

    // Отчёт печатается всегда: по нему видно, стоит ли подключать LLM-слой.
    const misses = posts
      .filter((post) => classify(post.text).section !== post.expected)
      .map((post) => `  «${post.manualTitle}»: ждали ${post.expected}, вышло ${classify(post.text).section}`)
    console.info(
      `Рубрикатор: ${hits.length}/${posts.length} (${Math.round(share * 100)} %)` +
        (misses.length ? `\nПромахи:\n${misses.join('\n')}` : ''),
    )

    expect(share).toBeGreaterThanOrEqual(0.85)
  })
})
