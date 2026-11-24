#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick up nvm-managed Node and user-local binaries (yt-dlp, ffmpeg) when launched from GUI dock
if [[ -d "$HOME/.nvm/versions/node" ]]; then
  LATEST_NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -n "$LATEST_NODE_BIN" ]]; then
    export PATH="$LATEST_NODE_BIN:$PATH"
  fi
fi
export PATH="$HOME/.local/bin:$PATH"

cd "$APP_DIR"

if [[ ! -f "$APP_DIR/dist/index.html" || ! -f "$APP_DIR/dist-electron/main.js" ]]; then
  npm run build
fi

ELECTRON_BIN="$APP_DIR/node_modules/.bin/electron"
if [[ -x "$ELECTRON_BIN" ]]; then
  exec "$ELECTRON_BIN" --no-sandbox --class=Localify "$APP_DIR" "$@"
fi

exec npx electron --no-sandbox --class=Localify "$APP_DIR" "$@"
