-- Догоняющая правка схемы: рукописная миграция 20260804_123500 завела коллекцию
-- Categories, но не добавила её в служебную таблицу блокировок Payload. Из-за этого
-- ЛЮБОЕ обновление существующего документа падало 500 (errorMissingColumn:
-- payload_locked_documents_rels.categories_id), а создание работало — поэтому дыра и
-- дожила до первого переимпорта черновиков.
--
-- Это ровно тот случай, ради которого писался наш же чеклист сверки схемы (G231):
-- новая коллекция трогает больше таблиц, чем кажется.
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "categories_id" integer;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_categories_id_idx"
  ON "payload_locked_documents_rels" USING btree ("categories_id");

DO $$
BEGIN
  ALTER TABLE "payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
    FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
