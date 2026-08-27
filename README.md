# KalininoCKS

**МКУК Калининская ЦКС** — каркас (skeleton) сайта на стеке кластера. Контента нет: это
пустая, развёртываемая заготовка, которую редактор наполняет позже (план —
импорт из VK / ручное наполнение через админку).

**Стек:** Next.js 15 + Payload CMS 3.75.0 + PostgreSQL · TypeScript · pnpm 10 (corepack).
Язык интерфейса и контента — только русский (RU).

Приложение живёт в [`web/`](web/).

## Что внутри каркаса

Коллекции: `Users`, `Media`, `Pages` (статические страницы), `Posts` (новости).
Глобалы: `SiteHeader`, `SiteFooter`, `HomeContent` (тексты главной).
Фронт: главная (рендерит тексты + последние новости), `pages/[slug]`,
лента новостей `news` + `news/[slug]`, корневой layout с шапкой/подвалом.
Стиль — нейтральный, без оформления (декор/тема не переносились из донора).

## Быстрый старт (локально)

```bash
corepack prepare pnpm@10.15.0 --activate
corepack pnpm -C web install
cp web/.env.example web/.env        # подставить DATABASE_URI (БД kalinino) и PAYLOAD_SECRET
corepack pnpm -C web generate:importmap
corepack pnpm -C web generate:types
corepack pnpm -C web dev            # http://localhost:3000  ·  админка /admin
```

## Структура

| Путь | Что |
|---|---|
| [`web/`](web/) | Next + Payload приложение (коллекции, фронт, админка) |
| [`.github/workflows/`](.github/workflows/) | CI: `deploy-prod.yml`, `apply-migration.yml` |
| [`deploy/`](deploy/) | `kalinino.service` — systemd-юнит прод-сервера |

## Деплой (кратко)

Сборка едет в CI (GitHub Actions), на сервер по SSH кладётся standalone-артефакт,
рестартится systemd-юнит `kalinino.service`. Подробности — в `.github/workflows/deploy-prod.yml`.
Секреты/переменные репозитория и подготовку сервера делает оркестратор (brain).
Реквизиты площадки в репозитории не хранятся — см. `AGENTS.md` §🛡 Публичный репозиторий.
