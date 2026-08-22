import { NextResponse } from 'next/server'

/**
 * Клик по информеру в подвале → публичная страница статистики счётчика.
 *
 * Отдельный редирект нужен по той же причине, что и прокси картинки
 * (`/api/analytics-informer`): номер счётчика живёт в env бокса, а подвал попадает
 * в статические пререндеры — значит в разметке должен стоять постоянный URL,
 * а id подставляться на запросе.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const counterId = Number(process.env.YM_COUNTER_ID) || 0
  const target = counterId
    ? `https://metrika.yandex.ru/stat/?id=${counterId}&from=informer`
    : new URL('/', request.url).toString()
  return NextResponse.redirect(target, 307)
}
