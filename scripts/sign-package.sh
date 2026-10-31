#!/usr/bin/env bash
#
# sign-package.sh <zip>
#
# Signs a package built by build-update-package.sh with the CaeloWorks identity
# of the Certified PixInsight Developer program (CPD Program Rules, rule 5.1),
# in place: the zip gains <NAME>.xsgn and is re-zipped reproducibly, and the
# update-package.json next to it gets the new sha1. The signed zip and its sidecar
# are built in a work directory and checked there with check-package.sh --signed
# and verify-signature.sh; only once both pass do they replace the originals, so
# a failed signing or verification leaves the unsigned zip and sidecar untouched.
#
#   XSSK_PATH=/path/to/caeloworks.xssk scripts/sign-package.sh dist/ForaxxPaletteStudio-X.Y.Z.zip
#
# The key password is read from stdin: prompted on a terminal, one line when
# piped. It is passed only through the environment of the PixInsight process that
# signs, and never written anywhere.
#
# What gets signed, and why only that:
#   Only the entry script, into <NAME>.xsgn. Its signature covers every file it
#   #includes, recursively - CodeSigning.html, section 6, and measured on
#   PixInsight 1.9.5: one line of code added to an included file turns the entry
#   signature invalid. Signing the lib/ files too is useless (their signatures are
#   never verified) and the core refuses it anyway, since they carry no
#   #feature-id. A comment added to any file does NOT invalidate the signature:
#   the signed code is canonicalized, so a tamper test has to change code.
#
#   Entitlements: the signature declares none (generateScriptSignatureFile gets
#   [], and the .xsgn carries no <Entitlements> element). verify-signature.sh
#   still prints com.pixinsight.security.pjsr.*,com.pixinsight.security.pcl.*:
#   those belong to the CaeloWorks identity, from its entry in PixInsight's
#   etc/security/certified-developers.xcdev - the standard set nearly every
#   certified developer has. Nothing in the script needs more.
#
#   The file signed is the one in the zip, after the version stamp: the stamp
#   changes code, so a signature made on pjsr/ in the repository would not hold.
#
# A signed zip is not reproducible: the signature carries a timestamp, so each
# signing gives a new sha1. The sidecar is what carries the right one.
#
set -euo pipefail

ZIP="${1:?usage: sign-package.sh <zip>}"
[ -f "$ZIP" ] || { echo "error: no such file: $ZIP" >&2; exit 1; }
ZIP="$( cd "$( dirname "$ZIP" )" && pwd )/$( basename "$ZIP" )"
SIDECAR="$( dirname "$ZIP" )/update-package.json"
[ -f "$SIDECAR" ] || { echo "error: no update-package.json next to $ZIP" >&2; exit 1; }
: "${XSSK_PATH:?set XSSK_PATH to the CaeloWorks signing keys (.xssk)}"
[ -f "$XSSK_PATH" ] || { echo "error: XSSK_PATH not found: $XSSK_PATH" >&2; exit 1; }

NAME="ForaxxPaletteStudio"
DEVELOPER="CaeloWorks"
VENDOR="src/scripts/CaeloWorks/$NAME"
REPO="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# shellcheck source=scripts/pi-run.sh
. "$REPO/scripts/pi-run.sh"
pi_setup
WORK="$( pi_tmpdir )"
trap 'rm -rf "$WORK" "$ZIP.signing" "$SIDECAR.signing"' EXIT

mkdir -p "$WORK/pkg"
( cd "$WORK/pkg" && unzip -q "$ZIP" )
[ -f "$WORK/pkg/$VENDOR/$NAME.js" ] || { echo "error: no $VENDOR/$NAME.js in $ZIP" >&2; exit 1; }
# Re-signing replaces, never stacks: start from no signature at all.
find "$WORK/pkg" -name '*.xsgn' -delete

# The files to sign, relative to the package directory, ';'-separated. The runner
# takes a list so that a second entry point, if one is ever added, is one word.
SIGN_LIST="$NAME.js"

if [ -t 0 ]; then
  printf 'PixInsight signing-key password for %s (not stored): ' "$DEVELOPER" >&2
fi
# IFS= so that leading and trailing spaces are kept: they are part of a password.
IFS= read -r -s __PW || true
[ -t 0 ] && echo >&2
[ -n "$__PW" ] || { echo "error: no password given" >&2; exit 1; }

# The runner signs, then checks each signature back through the core rather than
# trusting that a .xsgn appeared: a wrong password or a foreign key must fail here.
cat > "$WORK/sign.js" <<'PJSR'
var dir    = getEnvironmentVariable( "FXSIGN_DIR" ).replace( /\\/g, "/" );
var files  = getEnvironmentVariable( "FXSIGN_FILES" ).split( ";" );
var xssk   = getEnvironmentVariable( "FXSIGN_XSSK" ).replace( /\\/g, "/" );
var pw     = getEnvironmentVariable( "FXSIGN_PW" );
var report = getEnvironmentVariable( "FXSIGN_REPORT" ).replace( /\\/g, "/" );
var lines  = [];
for ( var i = 0; i < files.length; ++i )
{
   var js = dir + "/" + files[i];
   var xsgn = js.replace( /\.js$/, ".xsgn" );
   try
   {
      Security.generateScriptSignatureFile( xsgn, js, [], xssk, pw );
      var sig = Security.getScriptSignature( js );
      lines.push( ( sig.valid ? "valid " : "invalid " ) + sig.developerId + " " + files[i] );
   }
   catch ( e )
   {
      lines.push( "error - " + files[i] + " : " + e );
   }
}
lines.push( "done" );
File.writeTextFile( report, lines.join( "\n" ) + "\n" );
PJSR

REPORT="$WORK/report.txt"
FXSIGN_DIR="$( pi_native "$WORK/pkg/$VENDOR" )" FXSIGN_FILES="$SIGN_LIST" \
FXSIGN_XSSK="$( pi_native "$XSSK_PATH" )" FXSIGN_PW="$__PW" \
FXSIGN_REPORT="$( pi_native "$REPORT" )" \
  pi_run "$WORK/sign.js" FXSIGN_DIR FXSIGN_FILES FXSIGN_XSSK FXSIGN_PW FXSIGN_REPORT
unset __PW

[ -f "$REPORT" ] || {
  echo "error: PixInsight did not run the signing script" >&2
  echo "       (the runner is an unsigned script: is Preferences > Security >" >&2
  echo "       Allow execution of unsigned scripts turned on for this PixInsight?)" >&2
  exit 1
}
tr -d '\r' < "$REPORT" | sed 's/^/  sign: /' >&2
fail=0
IFS=';' read -r -a sign_files <<< "$SIGN_LIST"
for f in "${sign_files[@]}"; do
  grep -qxF "valid $DEVELOPER $f" <( tr -d '\r' < "$REPORT" ) \
    || { echo "error: $f is not validly signed by $DEVELOPER" >&2; fail=1; }
  [ -f "$WORK/pkg/$VENDOR/${f%.js}.xsgn" ] || { echo "error: no ${f%.js}.xsgn produced" >&2; fail=1; }
done
[ "$fail" = 0 ] || exit 1
rm -f "$WORK/sign.js" "$REPORT"

# Re-zip exactly as the build does, and give a copy of the sidecar the new sha1,
# both in the work directory.
mkdir -p "$WORK/out"
OUT_ZIP="$WORK/out/$( basename "$ZIP" )"
OUT_SIDECAR="$WORK/out/update-package.json"
python3 "$REPO/scripts/repro-zip.py" "$WORK/pkg" "$OUT_ZIP"
cp "$SIDECAR" "$OUT_SIDECAR"
SHA1="$( sha1sum "$OUT_ZIP" | cut -d' ' -f1 )"
python3 - "$OUT_SIDECAR" "$SHA1" <<'PY'
import json, sys
path, sha1 = sys.argv[1], sys.argv[2]
with open(path) as f:
    meta = json.load(f)
meta["sha1"] = sha1
with open(path, "w") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

# Check the signed zip before it replaces anything: set -e stops here on a
# failure, and the original zip and sidecar are still the unsigned ones.
bash "$REPO/scripts/check-package.sh" --signed "$OUT_ZIP"
bash "$REPO/scripts/verify-signature.sh" "$OUT_ZIP"

# Swap into place. The work directory may sit on another filesystem, so copy next
# to the target first and rename there: each file is replaced in one step.
cp "$OUT_ZIP" "$ZIP.signing"
cp "$OUT_SIDECAR" "$SIDECAR.signing"
mv "$ZIP.signing" "$ZIP"
mv "$SIDECAR.signing" "$SIDECAR"
echo "$( basename "$ZIP" ) signed by $DEVELOPER - sha1 $SHA1 (update-package.json updated)"
