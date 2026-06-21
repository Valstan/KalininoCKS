import { HomeView } from './_views/HomeView'

// Главная. Тело — _views/HomeView (тексты главной + последние новости). ISR.
export const revalidate = 60

export default function HomePage() {
  return <HomeView />
}
