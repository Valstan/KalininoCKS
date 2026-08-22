import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Догоняющая правка схемы: рукописная миграция 20260804_123500 завела коллекцию
// Categories, но не добавила её в служебную таблицу блокировок Payload. Из-за этого
// любое ОБНОВЛЕНИЕ существующего документа падало 500 (errorMissingColumn на
// payload_locked_documents_rels.categories_id), а создание работало — поэтому дыра
// дожила до первого переимпорта черновиков.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
   END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
   DROP INDEX IF EXISTS "payload_locked_documents_rels_categories_id_idx";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "categories_id";`)
}
