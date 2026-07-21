# CLAUDE.md — entry point для AI-сессий «Калинино ЦКС»

Первый файл, который Claude читает в новой сессии проекта. Подсказывает, **где взять контекст** и **как правильно работать**. Проект — часть экосистемы **brain_matrica** (мета-репо управления). Карточка проекта: [`../brain_matrica/projects/KalininoCKS.md`](../brain_matrica/projects/KalininoCKS.md). Концепт малмыж-кластера: [`../brain_matrica/docs/plans/malmyzh-sites-rebuild-concept.md`](../brain_matrica/docs/plans/malmyzh-sites-rebuild-concept.md).

## Быстрые факты

- **Что это:** сайт **МКУК «Калинино ЦКС»** (Централизованная клубная система) — калинино-цкс.рф; малмыж-кластер вместе с вМалмыже и ДК Малмыж.
- **Прод:** https://калинино-цкс.рф/ — **Бокс 1** (`831d0ce99bdf.vps.myjino.ru`), порт **:3006**, nginx + TLS (LE через панель Джино).
- **Стек:** Next.js 15 App Router + **Payload 3.75 + PostgreSQL** (стандарт экосистемы, стек Сабантуя), pnpm, standalone-сборка в CI.
- **Статус:** ⏸ **каркас на проде, ждёт наполнения контентом владельцем** (из ВК) — это осознанная пауза by design, не заброшенность.
- **Код сайта — в `web/`**, деплой-обвязка — в `deploy/`.

## Гейты и деплой

- Гейты перед PR (если трогался код): `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build` (build требует локальный Postgres — Payload лезет в БД на пререндере).
- Мерж в `main` → **авто-деплой на прод** (`deploy-prod.yml`). ⚠️ У воркфлоу `paths-ignore`: `docs/**`, `**.md`, `.github/**`, `.claude/**` — эти файлы деплой **не** триггерят (поэтому brain-интеграция и доки не гоняют пересборку).
- Миграции схемы Payload — **вручную ДО деплоя** через `apply-migration.yml` (workflow_dispatch, migration-guard #017), затем деплой через dispatch.
- PR-flow: ветка → PR → squash-merge. **Прямых пушей в `main` нет.**

## 📬 Mailbox check — ДО любой другой работы (ADR-0001 v3)

Асимметричные mailbox'ы: каждая сторона пишет только в свой репо.

| Направление | Кто пишет | Где |
|---|---|---|
| `brain → Калинино ЦКС` | brain | `../brain_matrica/mailboxes/KalininoCKS/from-brain/*.md` (мы только **читаем** после `git pull --ff-only`) |
| `Калинино ЦКС → brain` | мы | **`mailbox/to-brain/*.md`** в этом репо (через PR) |

Сканить только корень `from-brain/` (не `DRAFTS/`, не `ARCHIVE/`). Compliance: `mandate`→MUST, `recommend`→SHOULD (отказ обосновать письмом), `suggest`→MAY. Письма без `compliance`: `directive`→MUST, `idea`→SHOULD. ❌ **Никогда не писать/коммитить в `../brain_matrica/`** (read-only).

Формат исходящего письма `mailbox/to-brain/YYYY-MM-DD-slug.md`:

```yaml
---
from: KalininoCKS
to: brain
date: YYYY-MM-DD
topic: ...
kind: idea | question | feedback | report
compliance: suggest | recommend | mandate   # для kind=idea
urgency: low | normal | high
---
```

## Session-память и команды

- `docs/SESSION_HANDOFF.md` — статус/нитка/следующий шаг (обновляет `/close_session`, читает `/start`).
- `/start` — синхра репо + mailbox-check от brain + чтение handoff.
- `/close_session` — сохранить состояние, всё на origin через PR (brain не трогать).
- `/obriv` — восстановление после обрыва связи (самопроверка целостности + продолжение).
