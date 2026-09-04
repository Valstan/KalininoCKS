#!/usr/bin/env bash
# Выгрузка проекта «Калинино ЦКС» для передачи в ДК Малмыж (D-074).
# Только чтение прод-данных; ничего не выключает и не удаляет.
set -euo pipefail

OUT="$HOME/kalinino/handover-2026-09-04"
MEDIA_DIR="$HOME/kalinino/shared/media"
SQL="${1:-$(dirname "$0")/export.sql}"

DBURI=$(sudo -n grep -E '^DATABASE_URI=' /etc/kalinino/kalinino.env | cut -d= -f2-)
[ -n "$DBURI" ] || { echo "DATABASE_URI пуст" >&2; exit 1; }

mkdir -p "$OUT"
chmod 750 "$OUT"

echo "== 1. pg_dump (custom) =="
# Схема целиком, данные — без транзитного состояния Payload (сессии, блокировки, предпочтения админки).
pg_dump "$DBURI" -Fc --no-owner --no-privileges \
  --exclude-table-data=users_sessions --exclude-table-data='payload_locked_documents*' \
  --exclude-table-data='payload_preferences*' --exclude-table-data=payload_kv \
  -f "$OUT/kalinino.dump"
pg_restore -l "$OUT/kalinino.dump" > "$OUT/kalinino.dump.toc.txt"
pg_dump "$DBURI" --schema-only --no-owner --no-privileges -f "$OUT/kalinino.schema.sql"
psql "$DBURI" -Atc "select version()" > "$OUT/kalinino.dump.server-version.txt"
echo "dump: $(du -h "$OUT/kalinino.dump" | cut -f1), toc entries: $(grep -c '^[0-9]' "$OUT/kalinino.dump.toc.txt")"

echo "== 2. JSON-экспорты из БД =="
psql "$DBURI" -v outdir="$OUT" -q -f "$SQL"
for f in categories posts media manual-edits; do
  if [ -s "$OUT/$f.json" ]; then jq . "$OUT/$f.json" > "$OUT/$f.json.tmp" && mv "$OUT/$f.json.tmp" "$OUT/$f.json"; else echo '[]' > "$OUT/$f.json"; fi
  printf '%s: %s записей\n' "$f" "$(jq length "$OUT/$f.json")"
done
cat "$OUT/.stats.txt"

echo "== 3. Манифест медиа =="
# Карта файл -> vkPostId из БД; для файлов, которых нет в БД, vkPostId выводится из имени vk--<owner>_<post>-...
declare -A VK POSTID MID
while IFS=$'\t' read -r fn mid vk pid; do VK["$fn"]="$vk"; POSTID["$fn"]="$pid"; MID["$fn"]="$mid"; done < "$OUT/.file-to-vk.tsv"
: > "$OUT/media-manifest.tsv"
printf 'path\tsha256\tsize\tmediaId\tvkPostId\tpostId\tsource\n' >> "$OUT/media-manifest.tsv"
n=0; orphan=0
while IFS= read -r -d '' f; do
  rel="${f#"$MEDIA_DIR"/}"
  sha=$(sha256sum "$f" | cut -d' ' -f1)
  size=$(stat -c %s "$f")
  vk="${VK[$rel]:-}"; pid="${POSTID[$rel]:-}"; mid="${MID[$rel]:-}"; src="db"
  if [ -z "$mid" ]; then
    src="filename"; orphan=$((orphan+1))
    if [[ "$rel" =~ ^vk-(-?[0-9]+_[0-9]+)- ]]; then vk="${BASH_REMATCH[1]}"; fi
  elif [ -z "$vk" ]; then
    # Есть в media, но ни обложкой, ни в галерее не используется (осиротевшие загрузки переимпорта 22.08).
    src="db-unlinked"
    if [[ "$rel" =~ ^vk-(-?[0-9]+_[0-9]+)- ]]; then vk="${BASH_REMATCH[1]}"; fi
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$rel" "$sha" "$size" "$mid" "$vk" "$pid" "$src" >> "$OUT/media-manifest.tsv"
  n=$((n+1))
done < <(find "$MEDIA_DIR" -type f -print0 | sort -z)
echo "файлов: $n, не числятся в БД (сопоставлены по имени): $orphan"
echo "не привязаны к постам (есть в media, но без обложки/галереи): $(awk -F'\t' 'NR>1 && $7=="db-unlinked"' "$OUT/media-manifest.tsv" | wc -l)"

echo "== 4. Tarball медиа =="
tar czf "$OUT/media.tar.gz" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
sha256sum "$OUT/media.tar.gz" | cut -d' ' -f1 > "$OUT/media.tar.gz.sha256"
echo "media.tar.gz: $(du -h "$OUT/media.tar.gz" | cut -f1)"

echo "== 5. Проверка на секреты в выгрузке =="
# Значения из env-файла не должны встречаться ни в одном текстовом файле выгрузки.
leak=0
while IFS= read -r val; do
  [ ${#val} -ge 8 ] || continue
  if grep -rqF -- "$val" "$OUT"/*.json "$OUT"/*.txt "$OUT"/*.tsv "$OUT"/*.sql 2>/dev/null; then leak=1; echo "!! значение из env найдено в текстовой выгрузке"; fi
  if pg_restore -f - "$OUT/kalinino.dump" 2>/dev/null | grep -qF -- "$val"; then leak=1; echo "!! значение из env найдено в дампе"; fi
done < <(sudo -n grep -E '^[A-Z_]+=' /etc/kalinino/kalinino.env | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | grep -vE '^(1|0|true|false|3006|65000|/home/.*media|https?://[^/]*$)$')
# Непустой контроль (#262): тот же grep должен найти заведомо присутствующую строку.
grep -qF 'vk_post_id' "$OUT/kalinino.schema.sql" || { echo "!! контроль грепа не сработал"; exit 1; }
[ $leak -eq 0 ] && echo "секреты: не найдены (контроль непустой — ок)"

rm -f "$OUT/.file-to-vk.tsv" "$OUT/.stats.txt"
echo "== Итог =="
ls -la "$OUT"
du -sh "$OUT"
