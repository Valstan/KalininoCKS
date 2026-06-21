// Единый источник правды о сайте — URL, название, описание. Используется в
// метаданных, robots, sitemap. Боевой URL бейкается из env при сборке; фолбэк —
// punycode-домен калинино-цкс.рф (кириллица в CI-bash бьётся — поэтому ASCII-форма).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SERVER_URL || 'https://xn----7sbyahedrbk9azd.xn--p1ai'
).replace(/\/$/, '')

export const SITE_NAME = 'Калининская ЦКС'

export const SITE_DESC = 'МКУК Калининская ЦКС — официальный сайт. Новости и материалы.'
