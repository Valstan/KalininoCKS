-- Экспорт для передачи в ДК Малмыж (D-074). Только контентные данные, без users/sessions/секретов.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\pset fieldsep '\t'

\o :outdir/categories.json
select json_agg(json_build_object(
  'id', id, 'title', title, 'slug', slug, 'order', "order",
  'createdAt', created_at, 'updatedAt', updated_at,
  'publishedPosts', (select count(*) from posts p where p.category_id = c.id and p._status = 'published'),
  'totalPosts', (select count(*) from posts p where p.category_id = c.id)
) order by "order", id) from categories c;

\o :outdir/posts.json
select json_agg(json_build_object(
  'id', p.id, 'title', p.title, 'slug', p.slug, 'date', p.date, 'publishedAt', p.published_at,
  'status', p._status, 'vkPostId', p.vk_post_id, 'sourceUrl', p.source_url,
  'categoryId', p.category_id, 'categorySlug', c.slug, 'legacyCategory', p.category,
  'coverId', p.cover_id, 'coverFilename', m.filename,
  'gallery', (select json_agg(json_build_object('order', r."order", 'mediaId', r.media_id, 'filename', gm.filename, 'path', r.path) order by r."order")
              from posts_rels r left join media gm on gm.id = r.media_id where r.parent_id = p.id),
  'videos', (select json_agg(to_jsonb(v) - 'id' - '_parent_id' order by v._order) from posts_videos v where v._parent_id = p.id),
  'content', p.content,
  'createdAt', p.created_at, 'updatedAt', p.updated_at
) order by p.date desc, p.id)
from posts p left join categories c on c.id = p.category_id left join media m on m.id = p.cover_id;

\o :outdir/media.json
select json_agg(json_build_object(
  'id', id, 'filename', filename, 'mimeType', mime_type, 'filesize', filesize, 'width', width, 'height', height,
  'alt', alt, 'caption', caption,
  'sizes', json_build_object(
    'thumbnail', sizes_thumbnail_filename, 'card', sizes_card_filename, 'wide', sizes_wide_filename),
  'createdAt', created_at, 'updatedAt', updated_at
) order by id) from media;

-- Карта файл → vkPostId для манифеста: базовый файл и все его размеры, через обложку и галерею.
\o :outdir/.file-to-vk.tsv
with usage as (
  select cover_id as media_id, vk_post_id, id as post_id from posts where cover_id is not null
  union
  select r.media_id, p.vk_post_id, p.id from posts_rels r join posts p on p.id = r.parent_id where r.media_id is not null
), files as (
  select id as media_id, filename from media
  union all select id, sizes_thumbnail_filename from media where sizes_thumbnail_filename is not null
  union all select id, sizes_card_filename from media where sizes_card_filename is not null
  union all select id, sizes_wide_filename from media where sizes_wide_filename is not null
)
select f.filename, f.media_id, coalesce(string_agg(distinct u.vk_post_id, ';'), ''), coalesce(string_agg(distinct u.post_id::text, ';'), '')
from files f left join usage u on u.media_id = f.media_id
group by f.filename, f.media_id order by f.filename;

-- Ручные правки: текущее состояние поста против самой первой версии (импорт) и против предыдущей версии.
\o :outdir/manual-edits.json
with firstv as (
  select distinct on (parent_id) * from _posts_v order by parent_id, created_at asc
), prevv as (
  select distinct on (parent_id) * from _posts_v where latest is not true order by parent_id, created_at desc
)
select json_agg(json_build_object(
  'postId', p.id, 'vkPostId', p.vk_post_id, 'title', p.title, 'status', p._status,
  'createdAt', p.created_at, 'updatedAt', p.updated_at, 'versions', (select count(*) from _posts_v v where v.parent_id = p.id),
  'changedSinceImport', json_build_object(
    'title', f.version_title is distinct from p.title,
    'content', f.version_content is distinct from p.content,
    'categoryId', f.version_category_id is distinct from p.category_id,
    'date', f.version_date is distinct from p.date,
    'cover', f.version_cover_id is distinct from p.cover_id,
    'slug', f.version_slug is distinct from p.slug,
    'status', f.version__status::text is distinct from p._status::text),
  'changedSincePrevVersion', case when pv.id is null then null else json_build_object(
    'prevVersionAt', pv.created_at,
    'title', pv.version_title is distinct from p.title,
    'content', pv.version_content is distinct from p.content,
    'categoryId', pv.version_category_id is distinct from p.category_id,
    'date', pv.version_date is distinct from p.date,
    'cover', pv.version_cover_id is distinct from p.cover_id,
    'status', pv.version__status::text is distinct from p._status::text) end,
  'importTitle', f.version_title, 'importCategoryId', f.version_category_id, 'importStatus', f.version__status,
  'importContent', case when f.version_content is distinct from p.content then f.version_content end
) order by p.id)
from posts p left join firstv f on f.parent_id = p.id left join prevv pv on pv.parent_id = p.id
where f.version_title is distinct from p.title or f.version_content is distinct from p.content
   or f.version_category_id is distinct from p.category_id or f.version_date is distinct from p.date
   or f.version_cover_id is distinct from p.cover_id or f.version__status::text is distinct from p._status::text
   or f.version_slug is distinct from p.slug;

\o :outdir/.stats.txt
select 'posts_total=' || count(*) from posts;
select 'posts_published=' || count(*) from posts where _status = 'published';
select 'posts_draft=' || count(*) from posts where _status = 'draft';
select 'media_rows=' || count(*) from media;
select 'categories=' || count(*) from categories;
select 'vk_post_id_sample=' || min(vk_post_id) from posts;
\o
