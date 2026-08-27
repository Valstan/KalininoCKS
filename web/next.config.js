import path from 'path'
import { fileURLToPath } from 'url'

import { withPayload } from '@payloadcms/next/withPayload'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NEXT_PUBLIC_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Прод-сервер `next build` не собирает. Сборка едет в CI
  // (GitHub Actions), на сервер кладём готовый standalone-сервер.
  // tracingRoot = web/ — чтобы server.js лёг в корень .next/standalone.
  //
  // ⚠️ standalone-сборка делает outputFileTracing, который МУТИРУЕТ локальный
  // node_modules. Поэтому standalone включаем ТОЛЬКО по флагу STANDALONE_BUILD=1
  // (его ставит deploy-prod.yml). Локальный `next build` — обычный, node_modules
  // не портит → можно собирать повторно без реинстолла.
  output: process.env.STANDALONE_BUILD === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL].map((item) => {
        const url = new URL(item)
        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  reactStrictMode: true,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
