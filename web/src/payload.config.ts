import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { HomeContent } from './globals/HomeContent'
import { SiteHeader } from './globals/SiteHeader'
import { SiteFooter } from './globals/SiteFooter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Калининская ЦКС',
    },
  },
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // MVP/greenfield: push автосинхронизирует схему в dev. Прод-миграции —
    // на этапе деплоя (web/src/migrations/).
    push: true,
  }),
  collections: [Pages, Posts, Categories, Media, Users],
  globals: [HomeContent, SiteHeader, SiteFooter],
  // Email-уведомления (опционально). Провайдеро-независимо: любой внешний SMTP-relay
  // задаётся через env. Пока SMTP_HOST не задан, адаптер не подключаем → Payload
  // пишет письма в консоль (dev/CI) — сборка и типы остаются зелёными без секретов.
  // Реальные SMTP-доступы живут ТОЛЬКО в /etc/kalinino/kalinino.env на проде.
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.SMTP_FROM_ADDRESS || 'no-reply@xn----8sbksaibjtblz.xn--80adkdyec4j.xn--p1ai',
        defaultFromName: process.env.SMTP_FROM_NAME || 'Калининская ЦКС',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          // 465 = implicit TLS (secure); 587/2525 = STARTTLS (secure:false).
          secure: process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE === 'true'
            : Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      })
    : undefined,
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  i18n: {
    fallbackLanguage: 'ru',
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
