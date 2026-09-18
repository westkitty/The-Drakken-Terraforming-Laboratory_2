#!/bin/zsh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SOURCE="$ROOT/macos/DrakkenLabWrapper.swift"
PLIST="$ROOT/macos/Info.plist"
BUILD_ROOT="$ROOT/macos/build"
APP_NAME="Drakken Terraforming Laboratory.app"
APP="$BUILD_ROOT/$APP_NAME"
INSTALL_APP="$HOME/Applications/$APP_NAME"
BACKUP_APP="$HOME/Applications/Drakken Terraforming Laboratory.previous.app"

ARCH="$(uname -m)"
TARGET="$ARCH-apple-macos13.0"
SDK="$(xcrun --sdk macosx --show-sdk-path)"
SWIFTC="$(xcrun --find swiftc)"

INSTALL=0
OPEN_APP=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    --open) OPEN_APP=1; INSTALL=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ -d "$APP" ]]; then
  rm -r "$APP"
fi
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

"$SWIFTC"   -parse-as-library   -sdk "$SDK"   -target "$TARGET"   -framework AppKit   -framework WebKit   -Onone   "$SOURCE"   -o "$APP/Contents/MacOS/DrakkenLabWrapper"

cp "$PLIST" "$APP/Contents/Info.plist"
chmod 755 "$APP/Contents/MacOS/DrakkenLabWrapper"
plutil -lint "$APP/Contents/Info.plist" >/dev/null
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

if (( INSTALL )); then
  mkdir -p "$HOME/Applications"
  if [[ -d "$BACKUP_APP" ]]; then
    rm -r "$BACKUP_APP"
  fi
  if [[ -d "$INSTALL_APP" ]]; then
    mv "$INSTALL_APP" "$BACKUP_APP"
  fi
  ditto "$APP" "$INSTALL_APP"
  echo "Installed: $INSTALL_APP"
  [[ -d "$BACKUP_APP" ]] && echo "Rollback: $BACKUP_APP"
fi

if (( OPEN_APP )); then
  open "$INSTALL_APP"
  echo "Opened: $INSTALL_APP"
fi

echo "Built: $APP"
