import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "categories" (
   	"id" serial PRIMARY KEY NOT NULL,
   	"title" varchar,
   	"slug" varchar,
   	"order" integer,
   	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
   	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );

   CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" USING btree ("slug");

   ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "category_id" integer;
   ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX IF NOT EXISTS "posts_category_idx" ON "posts" USING btree ("category_id");

   ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_category_id" integer;
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX IF NOT EXISTS "_posts_v_version_version_category_idx" ON "_posts_v" USING btree ("version_category_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_posts_v" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;
   DROP INDEX "_posts_v_version_version_category_idx";
   DROP INDEX "posts_category_idx";
   ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_category_id_categories_id_fk";
   ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_category_id";
   ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_category_id_categories_id_fk";
   ALTER TABLE "posts" DROP COLUMN IF EXISTS "category_id";
   DROP INDEX IF EXISTS "categories_slug_idx";
   DROP TABLE IF EXISTS "categories" CASCADE;`)
}
