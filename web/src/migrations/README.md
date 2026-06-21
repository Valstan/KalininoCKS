# Миграции БД (Payload)

Подход зеркалит SabantuyMalmyzh: каждая миграция — пара файлов с одинаковым именем:

- `<ts>_<name>.ts` — стандартная Payload-миграция (`up`/`down` через `db.execute(sql\`…\`)`),
  регистрируется в `index.ts`. Используется командой `payload migrate`.
- `<ts>_<name>.sql` — зеркальный чистый SQL того же `up()`. Нужен для ручного
  применения на проде через workflow `apply-migration.yml` (psql -f), т.к.
  `payload migrate` в CI/standalone недоступен/висит (drizzle push prompt).

## Начальная миграция

`20260621_145321_initial.{ts,sql}` — полная начальная схема каркаса
(коллекции pages/posts/media/users + версии, глобалы home/header/footer,
системные таблицы Payload). Сгенерирована локально (`pnpm migrate:create initial`)
против локального Postgres; `.sql` извлечён из `up()` и проверен `psql -f` на
чистой БД (создаёт 18 таблиц, exit 0).

## Что делает brain на ПЕРВОМ деплое

Вариант A (рекомендуемый, как в кластере) — применить SQL вручную до деплоя кода:

```bash
psql "$DATABASE_URI" -v ON_ERROR_STOP=1 -f web/src/migrations/20260621_145321_initial.sql
# затем зарегистрировать в реестре, чтобы payload migrate не пытался применить повторно:
psql "$DATABASE_URI" -c "INSERT INTO payload_migrations (name, batch) VALUES ('20260621_145321_initial', 1);"
```

Либо через workflow `apply-migration.yml` (input migration = `20260621_145321_initial`),
затем штатный деплой через `workflow_dispatch`.

Вариант B — дать Payload применить миграцию самому: на боксе с доступом к БД
`pnpm -C web migrate` (нужен payload CLI и DATABASE_URI). На проде стандартный
standalone-бандл CLI не несёт, поэтому в кластере используют вариант A.

> Примечание: `db-postgres` собран с `push: true` (dev-автосинхро схемы). На проде
> схему фиксируем миграцией (вариант A) — push на проде не запускается.
