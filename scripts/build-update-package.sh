#!/usr/bin/env bash
#
# build-update-package.sh <version> [releaseDate YYYYMMDD]
#
# Produces the standardized DISTRIBUTION ARTIFACT that the CaeloWorks showcase site
# (caelo-works/pixinsight-scripts, served at https://pixinsight-scripts.caelo.works/update/)
# ingests to build the shared, signed updates.xri. This repo does NOT generate or host the
# final updates.xri — it only emits, per release, two files under dist/:
#
#   dist/<NAME>-<version>.zip     the package, tree RELATIVE TO PixInsight's install dir
#   dist/update-package.json      metadata the site needs to emit the <package> element
#
# The zip is REPRODUCIBLE (sorted entries, fixed mtimes/permissions) so identical content
# always yields the same SHA-1 — the site authenticates the package by that SHA-1.
#
set -euo pipefail

# ----- script identity -------------------------------------------------------
NAME="ForaxxPaletteStudio"                   # class-case: entry file, package dir, icon
SLUG="foraxx-palette-studio"                 # kebab-case: site slug
TITLE="Foraxx Palette Studio"                # human name
DESCRIPTION_HTML="<p>Narrowband palette construction for PixInsight, dynamic Foraxx and every classic fixed mapping, with a live preview that runs the real pipeline rather than an approximation. Per-channel weighting and normalization, adjustable transition behaviour, independent star handling, a draggable per-image histogram driving a levels transform, HDR compression, an artificial CIE lightness layer, and hue-selective green and magenta suppression. Presets, settings persistence and process icons included. Interface in English and French.</p><p>Takes stretched channels, or linear ones with the auto stretch switched on.</p>"
# #engine v8 sets the floor. The directive predates 1.9.0 on some builds, but
# 1.9.0 is where it can be relied on, and it is the floor the sibling CaeloWorks
# scripts declare.
PI_VERSION_RANGE="1.9.0:1.9.99"
# -----------------------------------------------------------------------------

VERSION="${1:?usage: build-update-package.sh <version> [releaseDate YYYYMMDD]}"
RELEASE_DATE="${2:-$(date +%Y%m%d)}"

REPO="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
VENDORDIR="CaeloWorks/$NAME"
ZIPNAME="$NAME-${VERSION}.zip"
OUT="$REPO/dist"
STAGE="$( mktemp -d )"
trap 'rm -rf "$STAGE"' EXIT

DST="$STAGE/src/scripts/$VENDORDIR"
mkdir -p "$DST" "$STAGE/rsc/icons/script/$NAME"
rm -rf "$OUT"; mkdir -p "$OUT"

# 1) entry script — stamp the build
sed -e "s/__BUILD__/${VERSION}/g" "$REPO/pjsr/$NAME.js" > "$DST/$NAME.js"

# 1b) licence text ships next to the entry script. NOTICE.md ships with it and is not
#     optional: the upstream CC BY-NC 4.0 work this script builds on requires its
#     attribution to travel with every copy, and the zip is the only thing most users see.
cp "$REPO/LICENSE"   "$DST/LICENSE"
cp "$REPO/NOTICE.md" "$DST/NOTICE.md"

# 2) lib/ and assets/
mkdir -p "$DST/lib"
cp -R "$REPO"/pjsr/lib/. "$DST/lib/"

# 3) menu icon (#feature-icon @script_icons_dir/<NAME>.svg)
cp "$REPO/pjsr/assets/$NAME.svg" "$STAGE/rsc/icons/script/$NAME/$NAME.svg"

# 3b) No code signature here. A release is signed afterwards, on the zip this
#     script emits, by scripts/sign-package.sh: the version stamp above changes
#     code, so the signature can only be made on the stamped file.

# 4) reproducible zip: sorted entries, fixed mtime (1980-01-01), fixed perms
#    (0755 for bin/, 0644 otherwise). No OS/timestamp entropy -> stable SHA-1.
python3 "$REPO/scripts/repro-zip.py" "$STAGE" "$OUT/$ZIPNAME"

SHA1=$( sha1sum "$OUT/$ZIPNAME" | cut -d' ' -f1 )

# 5) metadata sidecar — exactly the contract the site ingests
cat > "$OUT/update-package.json" <<JSON
{
  "name": "${TITLE}",
  "slug": "${SLUG}",
  "version": "${VERSION}",
  "fileName": "${ZIPNAME}",
  "sha1": "${SHA1}",
  "type": "script",
  "releaseDate": "${RELEASE_DATE}",
  "piVersionRange": "${PI_VERSION_RANGE}",
  "title": "${TITLE} v${VERSION}",
  "descriptionHtml": "${DESCRIPTION_HTML}"
}
JSON

echo "dist/$ZIPNAME  ($(du -h "$OUT/$ZIPNAME" | cut -f1), sha1 $SHA1)"
echo "dist/update-package.json"
echo "  code signature: none yet - a release is signed with scripts/sign-package.sh"
