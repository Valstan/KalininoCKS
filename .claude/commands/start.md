---
description: Старт сессии «Калинино ЦКС» — синхра репо (#032) + mailbox-check от brain + чтение SESSION_HANDOFF
---

Выполни старт сессии «Калинино ЦКС» строго по шагам (детали — в `AGENTS.md` §📬 Mailbox check). Порядок жёсткий: **сначала синхронизация (шаги 1–2), потом чтение session-памяти (шаг 5)** — pool #032.

1. **Sync свой репо — ПЕРВЫМ:** `git fetch`; если working tree чист и есть отставание — `git checkout main && git pull --ff-only`. Незакоммиченное / не-ff — сообщи и не форсируй.
2. **Sync brain (read-only):** `cd ../brain_matrica && git pull --ff-only && cd -`. Не ff — сообщи, не форсируй.
3. **Скан входящих:** прочитай файлы в корне `../brain_matrica/mailboxes/KalininoCKS/from-brain/*.md` (НЕ `DRAFTS/`, НЕ `ARCHIVE/`).
4. **Доложи** сводку писем ДО чтения handoff:
   ```
   📬 N писем от brain_matrica:
   - [urgency COMPLIANCE] YYYY-MM-DD-slug — тема
   ```
   `urgency: high` выдели отдельно. Письма без `compliance`: `kind: directive`→MUST, `kind: idea`→SHOULD.
5. **Прочитай** `docs/SESSION_HANDOFF.md` — статус, нитка, следующий шаг. Если `Updated:` старше 14 дней — пометь «может быть неактуально».
6. **Сводка main:** `git log --oneline -5` и `git status`.
7. Кратко предложи следующий шаг из handoff.

Не начинай правки кода до завершения шагов 1–5.
