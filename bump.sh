#!/usr/bin/env bash
# 使い方: bash bump.sh [patch|minor|major] ["コミットメッセージ"]
# 例:     bash bump.sh patch
#         bash bump.sh minor "通報機能を追加"

set -e

TYPE=${1:-patch}
MSG=${2:-""}

# ── index.html から現行バージョンを取得 ──────────────────
CURRENT=$(grep -oP '(?<=Ver )\d+\.\d+\.\d+' index.html | head -1)
if [ -z "$CURRENT" ]; then
  echo "[bump] バージョンが見つかりません。index.html を確認してください。"
  exit 1
fi
echo "[bump] 現行バージョン: $CURRENT"

IFS='.' read -r MAJ MIN PAT <<< "$CURRENT"

# ── バージョンを計算 ─────────────────────────────────────
case "$TYPE" in
  major) MAJ=$((MAJ+1)); MIN=0; PAT=0 ;;
  minor) MIN=$((MIN+1)); PAT=0 ;;
  patch) PAT=$((PAT+1)) ;;
  *)
    echo "[bump] 不明なタイプ: $TYPE (patch/minor/major を指定してください)"
    exit 1
    ;;
esac

NEW="${MAJ}.${MIN}.${PAT}"
echo "[bump] 新バージョン: $NEW"

# ── index.html を更新 ────────────────────────────────────
sed -i "s/Ver ${CURRENT}/Ver ${NEW}/" index.html
echo "[bump] index.html 更新完了"

# ── sw.js を更新 ─────────────────────────────────────────
sed -i "s/'kayou-[^']*'/'kayou-${NEW}'/" sw.js
echo "[bump] sw.js 更新完了"

# ── git commit & push ────────────────────────────────────
git add index.html sw.js
if [ -n "$MSG" ]; then
  COMMIT_MSG="Ver ${NEW}: ${MSG}"
else
  COMMIT_MSG="Ver ${NEW}"
fi
git commit -m "$COMMIT_MSG"
git push
echo "[bump] プッシュ完了: $COMMIT_MSG"
