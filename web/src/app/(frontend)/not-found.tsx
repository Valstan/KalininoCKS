import Link from 'next/link'

export default function NotFound() {
  return (
    <section>
      <h1>Страница не найдена</h1>
      <p className="muted">К сожалению, такой страницы нет.</p>
      <p>
        <Link href="/">На главную</Link>
      </p>
    </section>
  )
}
