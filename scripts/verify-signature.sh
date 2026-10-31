#!/usr/bin/env bash
#
# verify-signature.sh <zip>
#
# Asks PixInsight whether the package's code signature is valid, on the files
# exactly as the zip carries them. Needs PixInsight (PI_EXE, or the standard
# Windows install when run from WSL) but neither the keys nor their password:
# verification uses the public key PixInsight distributes for every certified
# developer.
#
# check-package.sh --signed checks the shape; this checks the cryptography. A
# release passes both before it is published.
#
set -euo pipefail

ZIP="${1:?usage: verify-signature.sh <zip>}"
[ -f "$ZIP" ] || { echo "error: no such file: $ZIP" >&2; exit 1; }
ZIP="$( cd "$( dirname "$ZIP" )" && pwd )/$( basename "$ZIP" )"
NAME="ForaxxPaletteStudio"
DEVELOPER="CaeloWorks"
REPO="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# shellcheck source=scripts/pi-run.sh
. "$REPO/scripts/pi-run.sh"
pi_setup
WORK="$( pi_tmpdir )"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/pkg"
( cd "$WORK/pkg" && unzip -q "$ZIP" )
ENTRY="$WORK/pkg/src/scripts/CaeloWorks/$NAME/$NAME.js"
[ -f "$ENTRY" ] || { echo "error: no entry script in $ZIP" >&2; exit 1; }

cat > "$WORK/verify.js" <<'PJSR'
var js     = getEnvironmentVariable( "FXVERIFY_JS" ).replace( /\\/g, "/" );
var report = getEnvironmentVariable( "FXVERIFY_REPORT" ).replace( /\\/g, "/" );
var line;
try
{
   var sig = Security.getScriptSignature( js );
   line = ( sig.valid ? "valid" : "invalid" ) + " " + sig.developerId + " " + sig.scriptId
        + " " + sig.timestamp + " [" + sig.entitlements + "]";
}
catch ( e )
{
   line = "error " + e;
}
File.writeTextFile( report, line + "\n" );
PJSR

REPORT="$WORK/report.txt"
FXVERIFY_JS="$( pi_native "$ENTRY" )" FXVERIFY_REPORT="$( pi_native "$REPORT" )" \
  pi_run "$WORK/verify.js" FXVERIFY_JS FXVERIFY_REPORT

[ -f "$REPORT" ] || { echo "error: PixInsight did not run the verification script" >&2; exit 1; }
verdict="$( tr -d '\r' < "$REPORT" )"
echo "Code signature: $( basename "$ZIP" )"
echo "  $verdict"
case "$verdict" in
  "valid $DEVELOPER $NAME "*) echo "PASS"; exit 0 ;;
  *) echo "FAILED: expected a valid $DEVELOPER signature of $NAME"; exit 1 ;;
esac
