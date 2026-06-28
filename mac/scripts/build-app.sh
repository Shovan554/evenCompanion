#!/usr/bin/env bash
# Package the SwiftPM executable into a double-clickable EvenReminder.app.
# Produces ./EvenReminder.app (menu-bar agent app, ad-hoc signed so TCC/Reminders
# permission and UserDefaults behave like a normal installed app).
set -euo pipefail

cd "$(dirname "$0")/.."   # mac/ project root

APP_NAME="EvenReminder"
CONFIG="${1:-release}"     # pass "debug" for a faster, unoptimized build
BUNDLE="${APP_NAME}.app"

echo "==> Building (${CONFIG})..."
swift build -c "${CONFIG}"

BIN_PATH="$(swift build -c "${CONFIG}" --show-bin-path)/${APP_NAME}"
[ -f "${BIN_PATH}" ] || { echo "binary not found at ${BIN_PATH}"; exit 1; }

echo "==> Assembling ${BUNDLE}..."
rm -rf "${BUNDLE}"
mkdir -p "${BUNDLE}/Contents/MacOS" "${BUNDLE}/Contents/Resources"
cp "${BIN_PATH}" "${BUNDLE}/Contents/MacOS/${APP_NAME}"
cp "Sources/${APP_NAME}/Info.plist" "${BUNDLE}/Contents/Info.plist"
printf 'APPL????' > "${BUNDLE}/Contents/PkgInfo"

echo "==> Ad-hoc signing..."
codesign --force --deep --sign - "${BUNDLE}"

echo "==> Done: $(pwd)/${BUNDLE}"
echo "    Run it:   open '$(pwd)/${BUNDLE}'"
echo "    Install:  drag it into /Applications, then add to Login Items."
