-- Зеркальная копия up() из 20260802_173215.ts (миграция: gallery/videos/vkPostId для posts).
-- Применять на проде ДО деплоя кода, затем зарегистрировать в payload_migrations.

CREATE TABLE "posts_videos" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"title" varchar,
	"url" varchar
);

CREATE TABLE "posts_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"media_id" integer
);

CREATE TABLE "_posts_v_version_videos" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"url" varchar,
	"_uuid" varchar
);

CREATE TABLE "_posts_v_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"media_id" integer
);

ALTER TABLE "posts" ADD COLUMN "vk_post_id" varchar;
ALTER TABLE "_posts_v" ADD COLUMN "version_vk_post_id" varchar;
ALTER TABLE "posts_videos" ADD CONSTRAINT "posts_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_posts_v_version_videos" ADD CONSTRAINT "_posts_v_version_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "posts_videos_order_idx" ON "posts_videos" USING btree ("_order");
CREATE INDEX "posts_videos_parent_id_idx" ON "posts_videos" USING btree ("_parent_id");
CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
CREATE INDEX "posts_rels_media_id_idx" ON "posts_rels" USING btree ("media_id");
CREATE INDEX "_posts_v_version_videos_order_idx" ON "_posts_v_version_videos" USING btree ("_order");
CREATE INDEX "_posts_v_version_videos_parent_id_idx" ON "_posts_v_version_videos" USING btree ("_parent_id");
CREATE INDEX "_posts_v_rels_order_idx" ON "_posts_v_rels" USING btree ("order");
CREATE INDEX "_posts_v_rels_parent_idx" ON "_posts_v_rels" USING btree ("parent_id");
CREATE INDEX "_posts_v_rels_path_idx" ON "_posts_v_rels" USING btree ("path");
CREATE INDEX "_posts_v_rels_media_id_idx" ON "_posts_v_rels" USING btree ("media_id");
CREATE UNIQUE INDEX "posts_vk_post_id_idx" ON "posts" USING btree ("vk_post_id");
CREATE INDEX "_posts_v_version_version_vk_post_id_idx" ON "_posts_v" USING btree ("version_vk_post_id");
