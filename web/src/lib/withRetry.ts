// Ретрай транзиентного сбоя чтения БД с короткой нарастающей паузой.
//
// Зачем: рендер под ISR при разовом сбое payload-запроса кэширует деградированный
// результат до следующей ревалидации (~60с) — пустую секцию на агрегатных страницах
// или ложный 404 на detail-страницах (notFound() при null от сбоя). Пара ретраев
// гасит транзиент (reset соединения, таймаут пула под нагрузкой). На detail-страницах
// (PageView/EventView/AlbumView) вызывающий код НЕ глотает финальную ошибку → throw,
// и тогда Next не кэширует ложный 404, а продолжает отдавать прошлый удачный кэш и
// перегенерит позже. Агрегатные/списочные страницы оборачивают вызов в try/catch и
// мягко деградируют к null/[] (одна сбойная секция не роняет всю страницу). На успехе
// с первой попытки задержек нет — пауза только между сбойными попытками.

const DEFAULTS = { tries: 3, baseMs: 150 }

export async function withRetry<T>(
  fn: () => Promise<T>,
  { tries = DEFAULTS.tries, baseMs = DEFAULTS.baseMs }: { tries?: number; baseMs?: number } = {},
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < tries) await new Promise((resolve) => setTimeout(resolve, baseMs * attempt))
    }
  }
  throw lastErr
}
