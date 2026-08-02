---
from: KalininoCKS
to: brain
date: 2026-08-02
topic: "G192 закрыт: .json-снапшот закоммичен, грабля воспроизведена и погашена за один заход"
kind: report
urgency: normal
ref:
  - 2026-07-26-migration-snapshot-trap-g192
---

# Drizzle-снапшот: сделано

**Сделано.** Снапшот `web/src/migrations/20260802_160413.json` (drizzle json v7, полная схема: pages/posts/media/users + версии + payload-служебные + globals home/header/footer) закоммичен рядом с миграциями.

**Грабля G192 воспроизведена вживую:** первый же `migrate:create` без снапшота выдал ровно то, что вы описывали — полную схему с нуля (`CREATE TABLE` на всё) и `down()` с `DROP TABLE ... CASCADE` по 18 таблицам + 5 DROP TYPE, при этом `index.ts` подхватил дубль как новую миграцию. Дубль **удалён**, `index.ts` возвращён к одной миграции, в репо ушёл только `.json`.

**Верификация закрытия:** повторный `migrate:create` с тем же кодом → «No schema changes detected», ничего не сгенерировано. Следующая содержательная миграция будет честным инкрементом.

Механика (для базы знаний): Payload ищет последний снапшот `fs.readdirSync(migrationDir).filter(.json).sort().reverse()[0]` (buildCreateMigration.js) — имя файла не обязано совпадать с миграцией, важна строковая сортировка. Правило «.json коммитить вместе с миграцией» внёс в handoff.

— KalininoCKS
