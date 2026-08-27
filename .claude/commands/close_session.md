---
description: Закрыть сессию «Калинино ЦКС» — сохранить состояние в SESSION_HANDOFF и запушить всё через PR-flow
---

# /close_session — финализация сессии «Калинино ЦКС»

Цель: оставить **explicit pointer** «куда шли» в `docs/SESSION_HANDOFF.md` и убедиться, что **всё на `origin`** (handoff + рабочие PR), а brain не тронут.

## Когда вызывать / НЕ вызывать

- ✅ В конце сессии; перед пересадкой на другую машину; после значимого куска.
- ❌ После короткой консультации без правок — просто скажи, что состояние чистое.

## Шаг 1. Контекст

```bash
git branch --show-current
git status --short
git log --oneline -10
gh pr list --state open
```

## Шаг 2. Незакоммиченная работа → через PR-flow (НЕ в `main` напрямую)

Если `git status` непустой:
1. **Гейты** (если трогался код): `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build` (build требует Postgres — Payload на пререндере).
2. Ветка `feat/ fix/ chore/ docs/` → коммит → `git push -u origin <ветка>` → `gh pr create` → CI зелёный → `gh pr merge --squash --delete-branch`.
   - ⚠️ Мерж в `main` с изменением **кода** авто-деплоит на прод (`deploy-prod.yml`). Доки/`.md`/`.claude`/`.github` — `paths-ignore`, деплой не триггерят.
   - Миграции схемы — вручную ДО деплоя через `apply-migration.yml` (dispatch, guard #017).

## Шаг 3. Шеринг находки в brain (условный, pool #009)

Переносимый инсайт (паттерн / обход бага / приём)? 3-фильтр: значимость / переносимость / неочевидность.
- Да → создать `mailbox/to-brain/YYYY-MM-DD-slug.md` (`kind`, `compliance`, `urgency`) **в этом репо**.
- ❌ Никогда не писать в `../brain_matrica/`. **Тишина = норма.**

## Шаг 4. Записать `docs/SESSION_HANDOFF.md`

Абсолютные даты: **Статус** (что свежее/на проде), **Сделано** (пункт сессии), **Следующий шаг**, **Открытые вопросы владельцу**.

## Шаг 5. Закоммитить handoff через docs-PR

```bash
git checkout -b docs/handoff-<slug>
git add docs/SESSION_HANDOFF.md
git commit -m "docs: handoff — <резюме>"
git push -u origin docs/handoff-<slug>
gh pr create ... ; gh pr merge --squash --delete-branch
git checkout main && git pull --ff-only
```

## Шаг 6. Sync-гейт

```bash
git status --short                  # пусто
git rev-parse HEAD @{u}             # совпадают
cd ../brain_matrica && git status --short && cd -   # чисто
```

## Что НЕ делать

- ❌ `git push origin main` напрямую; `--force` / `reset --hard` по `main`.
- ❌ Писать/коммитить в `../brain_matrica/`.
- ❌ Оставлять незапушенные ветки/коммиты или висящий `git stash`.
