#!/usr/bin/env bash
#
# stage-dev.sh [dest]
#
# Stage the script tree into a folder for hand-testing in PixInsight WITHOUT a
# release: the #include paths in ForaxxPaletteStudio.js are relative, so staging
# pjsr/ intact lets you run it straight from Script > Execute Script File.
#
# Dest resolution: explicit argument, else $FX_DEV_DIR, else (on WSL) the
# Windows user's LocalAppData, else ~/ForaxxPaletteStudio-dev.
#
#   ./scripts/stage-dev.sh
#   -> then in PixInsight: Script > Execute Script File... ->
#      <dest>/ForaxxPaletteStudio.js
#
# To make it appear in the Scripts menu instead: Script > Feature Scripts... ,
# Add the <dest> directory, and it registers under CaeloWorks.
set -euo pipefail

NAME="ForaxxPaletteStudio"
REPO="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

default_dest() {
   if [ -n "${FX_DEV_DIR:-}" ]; then
      echo "$FX_DEV_DIR"
      return
   fi
   # On WSL, resolve the Windows user's LocalAppData through cmd.exe.
   if command -v cmd.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
      local lad
      lad="$( cd /mnt/c 2>/dev/null && cmd.exe /c "echo %LOCALAPPDATA%" 2>/dev/null | tr -d '\r' )"
      if [ -n "$lad" ] && [[ "$lad" != *%* ]]; then
         echo "$( wslpath "$lad" )/$NAME-dev"
         return
      fi
   fi
   echo "$HOME/$NAME-dev"
}

DEST="${1:-$(default_dest)}"

rm -rf "$DEST"
mkdir -p "$DEST/lib" "$DEST/assets"
cp "$REPO/pjsr/$NAME.js" "$DEST/"
cp -R "$REPO/pjsr/lib/." "$DEST/lib/"
cp -R "$REPO"/pjsr/assets/. "$DEST/assets/" 2>/dev/null || true

# The build stamp is only substituted at packaging time, so a dev staging has to
# derive one. The tag is the version, so use it when there is one; before the
# first tag, fall back to the newest released heading in the changelog. Either
# way the dialog shows a real number rather than the word "dev", which read as a
# bug in the footer.
stamp="$( git -C "$REPO" describe --tags --abbrev=0 2>/dev/null || true )"
if [ -z "$stamp" ]; then
   stamp="$( grep -m1 -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' "$REPO/CHANGELOG.md" \
             | tr -d '#[] ' || true )"
fi
[ -n "$stamp" ] || stamp="0.0.0"
sed -i "s/__BUILD__/${stamp}-dev/g" "$DEST/$NAME.js"

# Report the Windows-style path when staged under /mnt/c.
WINPATH="$DEST"
case "$DEST" in
  /mnt/c/*) WINPATH="C:${DEST#/mnt/c}"; WINPATH="${WINPATH//\//\\}" ;;
esac

echo "Staged to: $DEST"
echo
echo "In PixInsight:  Script > Execute Script File...  ->"
echo "    ${WINPATH}\\${NAME}.js"
echo
echo "Or register it in the menu:  Script > Feature Scripts... > Add"
echo "    ${WINPATH}"
