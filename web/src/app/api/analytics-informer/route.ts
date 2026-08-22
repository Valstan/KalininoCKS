import { NextResponse } from 'next/server'

/**
 * Прокси видимого информера Яндекс.Метрики — цифра посещаемости в подвале (D-017).
 *
 * Почему прокси, а не прямой `<img src="https://informer.yandex.ru/...">` (образец
 * Гоньбы, письмо `2026-08-10-metrika-live-li-out-g234-and-g136-amendment`):
 *  - **G80**: рунет-антибаннеры режут counter-домены — со своего origin картинка
 *    доезжает всем;
 *  - **приватность**: у посетителя ноль запросов к третьей стороне;
 *  - **URL постоянный** → подвал попадает в статические пререндеры, а номер счётчика
 *    резолвится из env бокса на запросе, а не запекается в CI-бандл.
 *
 * Не настроен `YM_COUNTER_ID` (или Метрика недоступна) → прозрачный 1×1: подвал не
 * ломается битой картинкой.
 *
 * ⚠️ G237: информер отдаёт валидную картинку **с нулями** ещё какое-то время после
 * включения — «200 и image/png» ничего не доказывает, приёмка только глазами по
 * цифрам. И числа в нём — только за сегодня (просмотры, визиты, посетители).
 */
export const dynamic = 'force-dynamic'

/** 88×31, тип «расширенный»: просмотры, визиты и уникальные посетители за сегодня. */
const INFORMER_VARIANT = '3_1_FFFFFFFF_EFEFEFFF_0_pageviews'

const TTL_MS = 5 * 60 * 1000

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** Кэш на процесс: бейдж меняется медленно, дёргать Яндекс на каждый показ подвала незачем. */
let cached: { at: number; body: Buffer; contentType: string } | null = null

const png = (body: Buffer, contentType: string, maxAge: number) =>
  new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })

export async function GET(): Promise<NextResponse> {
  const counterId = Number(process.env.YM_COUNTER_ID) || 0
  if (!counterId) return png(TRANSPARENT_PNG, 'image/png', 60)

  if (cached && Date.now() - cached.at < TTL_MS) {
    return png(cached.body, cached.contentType, 300)
  }

  try {
    const upstream = await fetch(
      `https://informer.yandex.ru/informer/${counterId}/${INFORMER_VARIANT}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    )
    if (!upstream.ok) return png(TRANSPARENT_PNG, 'image/png', 60)

    const body = Buffer.from(await upstream.arrayBuffer())
    const contentType = upstream.headers.get('content-type') || 'image/png'
    cached = { at: Date.now(), body, contentType }
    return png(body, contentType, 300)
  } catch {
    // Информер — украшение, а не функциональность: молча отдаём пустую картинку.
    return png(TRANSPARENT_PNG, 'image/png', 60)
  }
}
