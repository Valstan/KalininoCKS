# Калинино ЦКС — Session Handoff

> Sticky-note для непрерывности сессий. Перезаписывается `/close_session`. История — `git log -- docs/SESSION_HANDOFF.md`.

**Status:** CONTENT-FILL (наполнение контентом из ВК, задача владельца 02.08)
**Updated:** 2026-08-02
**Branch:** main

## Текущая нитка

**Наполнение сайта контентом ВК-сообщества `vk.ru/kalinino_sdk` (владелец, 02.08):** посты за последний месяц, даты публикации = оригинальные, заголовки — анализ текста (fallback — первые слова), картинки → галерея под текстом с лайтбоксом, видео — тоже. Контент берём ТОЛЬКО через VK-шлюз Сарафана (#062): заявка `GATEWAY_KEY_KALININO` отправлена (`mailbox/to-brain/2026-08-02-vk-gateway-key-request.md`). Сайт живёт на проде по https://сдк-калинино.вмалмыже.рф/ (punycode `xn----8sbksaibjtblz.xn--80adkdyec4j.xn--p1ai`), VPS Гоньба / Бокс 1, :3006.

## Сделано (сессия 2026-08-02)

- **ADR-0011 (mandate Мозга):** заведён `AGENTS.md` — единый vendor-neutral канон; `CLAUDE.md` сжат до адаптера, добавлен `GEMINI.md`; `.gitignore` += `.codex/`, `.gemini/`. Проверка 4 из поправки Мозга выполнена **до** сжатия: `.claude/commands/start.md:5` переведён на `AGENTS.md`, окна без канона не было. PR #4.
- **Домен `калинино-цкс.рф` утрачен.** Обнаружено при проверке видимости: парковка RU-CENTER, «срок регистрации истек» (продление до 14.08.2026), делегирование снято. Приложение и бокс были живы — сломана была только регистрация. **Решение владельца 02.08: не восстанавливать.**
- **Переезд на `сдк-калинино.вмалмыже.рф`:** на боксе переписан vhost `kalinino` (бэкап `kalinino.bak-20260802`), выпущен LE-сертификат `cert-name kalinino-sdk` (до 31.10.2026, автопродление certbot), редирект 80→443. Сертификата на это имя до 02.08 на боксе не было. В репо переведены `NEXT_PUBLIC_SERVER_URL` (GitHub vars) и фолбэк `web/src/lib/site.ts`; старый домен вычищен из `.env.example`, `payload.config.ts`, комментариев, `AGENTS.md`.
- **Подпись автора в подвале (mandate 2026-08-01):** «Разработка — Валентин Савиных», `rel="author"`, ссылка на `валентин.вмалмыже.рф` (портфолио проверено живым, 200). PR #5.
- **Деплой проверен целиком:** ручной прогон `deploy-prod.yml` (workflow_dispatch) — success, все шаги включая smoke-check. Снаружи `/`, `/news`, `/admin` → 200, подпись в HTML присутствует, `og:url` и `sitemap.xml` отдают новый домен.
- Мозгу отправлены два отчёта: `mailbox/to-brain/2026-08-02-adr-0011-done.md`, `2026-08-02-domain-change-and-footer.md`.
- **Ревизия гейтов #104 (mandate от 28.07):** контур = lint, typecheck, knip, Migration guard, build, smoke-check (6). Красные прогоны устроены и подтверждены для 4: lint (`no-sync-scripts` → 1), typecheck (TS2322 → 2), knip (unused files → 1; дефолтный репортер при этом крэшнулся 134 — флейк-наблюдение), Migration guard (фейковая миграция → 1). **Находка:** deploy-prod.yml не гоняет lint/typecheck/тесты вовсе — CI-гейты только guard/build/smoke; тесты, semgrep, gitleaks, branch-protection отсутствуют как класс (free-план 403). Предложено Мозгу перенести lint/typecheck в CI (ждём ответа). Отчёт: `mailbox/to-brain/2026-08-02-gate-audit-104.md`.
- **Drizzle-снапшот G192 (recommend от 26.07):** грабля воспроизведена вживую (`migrate:create` без снапшота = полный дубль схемы + DROP CASCADE в down), снапшот `web/src/migrations/20260802_160413.json` закоммичен, дубль-миграция удалена, `index.ts` восстановлен. Верификация: повторный `migrate:create` → «No schema changes detected». Правило: **`.json` коммитить вместе с каждой миграцией**. Ack: `mailbox/to-brain/2026-08-02-migration-snapshot-g192.md`.
- **Контент-модель под наполнение из ВК:** Posts += `gallery` (relationship media, hasMany), `videos` (array: title+url), `vkPostId` (unique, index — идемпотентность импорта). Миграция `20260802_173215.{ts,sql}` + снапшот `20260802_173215.json` (честный инкремент, G192). Локально применена (initial + новая на чистой БД). Компонент `MediaGallery` (сетка + лайтбокс: клик, ←/→, Esc, свайп, счётчик; mp4 → video, vk.com/video_ext.php → iframe), встроен в `PostView` под текстом. Гейты зелёные (lint/typecheck/build).
- **Разведка прода для импорта:** standalone `node_modules` НЕ содержит payload (только graphql/next/react/sharp/typescript) → `payload migrate`/CLI на проде нет; пользователей в БД нет (админа нет) → REST с JWT невозможен до создания админа. **План импорта:** Payload Local API с моей машины → прод-БД через SSH-туннель (karman host), медиа-файлы → scp в `/home/valstan/kalinino/shared/media` (MEDIA_DIR). Туннель не доверён (ssh -f -N не поднялся) — разобраться при импорте.

## Следующий шаг

1. **Ключ шлюза** — ждём от Мозга/Сарафана (заявка ушла). При получении: wall.get (последний месяц), анализ, темы, заголовки, импорт (план выше).
2. **Деплой контент-модели:** после merge → миграция на проде через `apply-migration.yml` (input `20260802_173215`), затем deploy через `workflow_dispatch` (push-деплой PR упадёт на Migration guard — это ожидаемо).
3. **Перенос lint/typecheck в CI** — предложено Мозгу по итогам #104, ждём ответа.

## Открытые вопросы владельцу

- `paths-ignore` в `deploy-prod.yml` **не отработал**: PR #4 менял только `**.md` и `.claude/**`, но авто-деплой всё равно запустился. Канон утверждает обратное. Разобраться, чинить ли фильтр (класс #104 — гейт/фильтр, который не делает того, что написано).
