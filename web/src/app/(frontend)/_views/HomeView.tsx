import Image from 'next/image'
import Link from 'next/link'
import config from '@payload-config'
import { getPayload } from 'payload'

import { SITE_NAME } from '../../../lib/site'
import { withRetry } from '../../../lib/withRetry'
import { PostCard } from './NewsView'
import type { PostListItem } from '../../../lib/portal'

type Home = {
  title?: string | null
  subtitle?: string | null
  intro?: string | null
  contacts?: string | null
}

async function getHome(): Promise<Home | null> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      return (await payload.findGlobal({ slug: 'home', depth: 0 })) as Home
    })
  } catch {
    return null
  }
}

async function getLatestPosts(): Promise<PostListItem[]> {
  try {
    return await withRetry(async () => {
      const payload = await getPayload({ config })
      const res = await payload.find({
        collection: 'posts',
        where: { _status: { equals: 'published' } },
        sort: '-date',
        depth: 1,
        limit: 5,
      })
      return res.docs as PostListItem[]
    })
  } catch {
    return []
  }
}

export async function HomeView() {
  const [home, posts] = await Promise.all([getHome(), getLatestPosts()])

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Село поёт — душа радуется</p>
          <h1>{home?.title || SITE_NAME}</h1>
          <p className="hero__subtitle">
            {home?.subtitle || 'Тёплое место для встреч, творчества и наших общих праздников'}
          </p>
          {home?.intro ? <p className="hero__intro">{home.intro}</p> : null}
          <div className="hero__actions">
            <Link className="button button--primary" href="/news">
              Свежие события
            </Link>
            <a className="button button--secondary" href="#traditions">
              Чем мы живём
            </a>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <span className="hero__sun" />
          <span className="hero__stitch hero__stitch--one">✦</span>
          <span className="hero__stitch hero__stitch--two">❋</span>
          <Image
            src="/brand/kalinino-emblem.webp"
            alt=""
            width={1254}
            height={1254}
            priority
          />
        </div>
      </section>

      <section id="traditions" className="traditions-section linen-panel">
        <div className="section-heading">
          <p className="eyebrow">Сделано с душой</p>
          <h2>Живые традиции Калинино</h2>
          <p>Здесь встречаются поколения, а каждый праздник становится общей семейной историей.</p>
        </div>
        <div className="traditions-grid">
          <article className="tradition-card tradition-card--red">
            <span aria-hidden="true">☀</span>
            <h3>Сельские праздники</h3>
            <p>Гостей встречаем щедро: песней, добрым словом и большим кругом друзей.</p>
          </article>
          <article className="tradition-card tradition-card--blue">
            <span aria-hidden="true">♫</span>
            <h3>Песня и сцена</h3>
            <p>Концерты, репетиции и выступления, которыми гордится родное село.</p>
          </article>
          <article className="tradition-card tradition-card--honey">
            <span aria-hidden="true">❋</span>
            <h3>Ремесло и память</h3>
            <p>Народный узор, семейные истории и мастерство, которое передают дальше.</p>
          </article>
        </div>
      </section>

      <section className="news-section">
        <div className="section-heading section-heading--left">
          <p className="eyebrow">У нас в клубе</p>
          <h2>Новости и добрые встречи</h2>
        </div>
        {posts.length === 0 ? (
          <div className="empty-news">
            <span aria-hidden="true">🪗</span>
            <div>
              <h3>Скоро заиграет музыка</h3>
              <p>Здесь появятся первые анонсы и вести из клубов.</p>
            </div>
          </div>
        ) : (
          <ul className="post-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} heading="h3" />
            ))}
          </ul>
        )}
        <p className="section-link">
          <Link href="/news">Все новости <span aria-hidden="true">→</span></Link>
        </p>
      </section>

      {home?.contacts ? (
        <section className="contacts-section linen-panel">
          <h2>Контакты</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{home.contacts}</p>
        </section>
      ) : null}
    </>
  )
}
