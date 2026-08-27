import { NextResponse } from 'next/server'

/**
 * Runtime-конфиг веб-аналитики: номер счётчика Яндекс.Метрики (D-017).
 *
 * Почему не `NEXT_PUBLIC_*`: сборка живёт в CI (прод-сервер next build не собирает), и
 * NEXT_PUBLIC-переменные запекаются в бандл на build-стадии — выключить или сменить
 * счётчик было бы нельзя без пересборки и деплоя. Этот роут читает env **процесса
 * на сервере** на каждый запрос: правка env-файла + рестарт сервиса — и всё.
 *
 * `force-dynamic` — иначе ISR заморозит значение на время жизни страницы.
 * Пустой env → 0 → клиент ничего не грузит.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ymCounterId: Number(process.env.YM_COUNTER_ID) || 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
