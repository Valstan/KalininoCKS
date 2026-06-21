// Форматирование даты новости/страницы в русском виде. Возвращает пустую строку
// для пустого/некорректного значения.
export function formatPostDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
