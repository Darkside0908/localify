#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/localify.desktop"

mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Localify
Comment=Offline Spotify-inspired music player with built-in YouTube downloader
Exec=$APP_DIR/launch.sh
Icon=$APP_DIR/assets/icon.svg
Terminal=false
Categories=AudioVideo;Audio;Music;Player;
StartupWMClass=Localify
EOF

chmod +x "$DESKTOP_FILE"
echo "Installed desktop entry at: $DESKTOP_FILE"
