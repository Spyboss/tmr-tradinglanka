#!/usr/bin/env bash
# TMR database backup - dumps MongoDB to a gzipped archive and optionally
# uploads it to a Telegram chat for off-machine storage.
#
# Usage:   ./backup-db.sh
# Reads:   MONGODB_URI, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
#          (from environment, or from backend/.env)
# Output:  ~/tmr-backups/tmr-backup-<timestamp>.gz  (keep last 7)
#
# Telegram setup (once):
#   1. Message @BotFather -> /newbot -> pick a name -> copy the token.
#   2. Message your new bot once, then open
#      https://api.telegram.org/bot<TOKEN>/getUpdates
#      and copy the "chat":{"id":...} number.
#   3. Add to backend/.env:
#      TELEGRAM_BOT_TOKEN=123456:ABC...
#      TELEGRAM_CHAT_ID=123456789

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${MONGODB_URI:?MONGODB_URI not set - add it to backend/.env}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/tmr-backups}"
KEEP="${KEEP:-7}"
TOOLS_BIN="${TOOLS_BIN:-$HOME/mongotools/mongodb-database-tools-ubuntu2204-x86_64-100.12.0/bin}"

if command -v mongodump >/dev/null 2>&1; then
  MONGODUMP="$(command -v mongodump)"
elif [[ -x "$TOOLS_BIN/mongodump" ]]; then
  MONGODUMP="$TOOLS_BIN/mongodump"
else
  echo "mongodump not found - install MongoDB Database Tools or set TOOLS_BIN" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/tmr-backup-$TS.gz"

"$MONGODUMP" --uri="$MONGODB_URI" --gzip --archive="$ARCHIVE"

if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
  if curl -fsS -F chat_id="$TELEGRAM_CHAT_ID" \
       -F caption="TMR backup $TS" \
       -F document=@"$ARCHIVE" \
       "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" >/dev/null 2>&1; then
    echo "Uploaded to Telegram."
  else
    echo "WARNING: Telegram upload failed - archive kept locally at $ARCHIVE"
  fi
else
  echo "No Telegram vars set - archive kept locally only."
fi

ls -1t "$BACKUP_DIR"/tmr-backup-*.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "Done: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
