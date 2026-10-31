# Releasing

1. **Node harness green**: `bash tests/run.sh` (expression suite + syntax check
   of every PJSR file, bundled or not). The Release workflow runs the same
   harness before building and fails the release if it is red — do not tag on a
   red harness.

2. **PixInsight hand gates.** This script is a dialog around a PixelMath
   pipeline; it cannot be exercised headless, and the harness only covers the
   expression layer. Run each of these in PixInsight before tagging:
   - `./scripts/stage-dev.sh`, then **Script → Feature Scripts → Add** the
     staged folder. The version label at the bottom of the dialog must read
     `vdev` — if it reads `v__BUILD__` the stamp substitution is broken.
   - **The parity gate.** On the reference master set, *Foraxx — classic* at
     defaults, starless only. The result must be **pixel-identical** to the
     previous tag's output on the same data. This is the promise the README
     makes and the one thing a release may never quietly break. Compare with
     PixelMath `abs($T - previous)` and check the maximum is 0.

     The reference set is a fixed, archived set of real Sii/Ha/Oiii masters —
     the same frames every time, never a fresh stack. The gate compares two
     builds, so any change in the input makes the comparison meaningless. Keep
     it outside the repository (masters are large and not ours to redistribute)
     and record here where it lives.
   - **Every palette builds.** Walk the whole style list in both 2- and
     3-channel mode. No exception dialog, no black output, the greyed controls
     grey out where 3.0.1 says they do.
   - **Preview equals Execute.** For at least one dynamic and one fixed palette,
     the preview and the executed result must agree beyond sampling. They run
     the same expression strings by construction; a divergence means that
     construction was broken.
   - **Settings and process icons migrate.** Open with a settings file and a
     process icon from the previous release. Nothing may silently change value.
   - **Clean console.** Read the log end to end and explain every warning.
   - **Signed, with unsigned scripts refused.** This one runs on the signed
     package, so after step 7: unpack the signed zip outside the
     installation, add it through **Feature Scripts…**, turn **Preferences →
     Security → Allow execution of unsigned scripts** off, and run it. The
     dialog must open and build an image. Then add one line of *code* (not a
     comment, which the signature ignores) to any `lib/` file of that copy: the
     script must now be refused. Turn the option back to what it was.

3. Update `CHANGELOG.md` — move `[Unreleased]` into a `[X.Y.Z]` section dated
   today, and record the validation evidence from step 2. Update the README
   version badge.

4. **Re-read `docs/ARCHITECTURE.md` against the code.** Every constant, default,
   file name, expression form and pipeline step named there must match what the
   code at the tag does. It is the contributor's map; a stale map sends the next
   fix to the wrong place.

5. Verify the git author is `caelo-works` (`git config user.name`). Never rely on
   the active `gh` account (it can flip at any time): inject the caelo-works token
   per command instead — `GH_TOKEN="$(gh auth token --user caelo-works)" gh …` for
   `gh`, and for git
   `GH_TOKEN="$(gh auth token --user caelo-works)" git -c credential.https://github.com.helper='!gh auth git-credential' push …`.

6. Commit, push `main` first, then tag and push the tag (so CI on `main` has run
   before the tag exists):
   ```
   git commit -am "vX.Y.Z: <headline>"
   GH_TOKEN="$(gh auth token --user caelo-works)" git -c credential.https://github.com.helper='!gh auth git-credential' push origin main
   git tag -a vX.Y.Z -m "vX.Y.Z — <headline>"
   GH_TOKEN="$(gh auth token --user caelo-works)" git -c credential.https://github.com.helper='!gh auth git-credential' push origin vX.Y.Z
   ```
   The tag starts the Release workflow: the full CI, then a **draft** release
   carrying the unsigned zip and `update-package.json`. A draft is invisible to
   the public and to the update site.

7. **Sign and publish the draft.** This is the CaeloWorks signing run, done from
   a machine with PixInsight and the keys, usually alongside the other
   CaeloWorks scripts:
   ```
   gh release download vX.Y.Z -R caelo-works/foraxx-palette-studio -D dist
   XSSK_PATH=/path/to/caeloworks.xssk scripts/sign-package.sh dist/ForaxxPaletteStudio-X.Y.Z.zip
   gh release upload vX.Y.Z -R caelo-works/foraxx-palette-studio --clobber dist/ForaxxPaletteStudio-X.Y.Z.zip dist/update-package.json
   gh release edit vX.Y.Z -R caelo-works/foraxx-palette-studio --draft=false
   ```
   (`gh` with the caelo-works token, as in step 5.) `sign-package.sh` reads the
   key password from stdin, signs the entry script as the zip carries it,
   re-zips, writes the new sha1 into `update-package.json`, then runs
   `check-package.sh --signed` and `verify-signature.sh`. Any other signing
   tool must meet the same contract: see *Code signing* below. Then run the
   signed hand gate from step 2.

8. **Notify the site agent**: comment on the tracking issue in
   `caelo-works/pixinsight-scripts` with the release URL, the zip **sha1** (from the
   published `update-package.json`, not another local build: a signed zip is not
   reproducible), and `piVersionRange`.

---

## Versioning

The **tag is the version**. `#define VERSION` in the entry script holds the
literal `__BUILD__`, stamped by `scripts/build-update-package.sh` at packaging
time and by `scripts/stage-dev.sh` as `dev`. There is no version number to keep
in step by hand and no way for the zip name and the dialog to disagree.

What makes a release major: anything that moves the pixels *Foraxx — classic*
produces at defaults. That output is the compatibility surface.

## Who validates what

The node harness covers the expression strings. It cannot tell you whether an
image looks right — no harness can, and the thing this script produces is
judged by eye.

That judgement came from the author, an astrophotographer working on his own
narrowband masters, and it is the reason 3.0.1 is worth inheriting rather than
rewriting: every default in it was settled against real data by someone who
knew what the result should look like. It is also why the hand gates above are
not optional ceremony. A release that passes CI and has not been looked at on
real frames has not been validated at all.

## Code signing

Every release is signed with the CaeloWorks identity of the Certified PixInsight
Developer program, as rule 5.1 of the CPD Program Rules requires. Without it,
users would have to allow the execution of unsigned scripts to run this one.

Signing happens **after** the build, on the zip, never in CI (no PixInsight, no
keys) and never in `build-update-package.sh`. `scripts/sign-package.sh` does it,
but whatever signs the package - that script or a signing run covering every
CaeloWorks script at once - must meet this contract, which
`check-package.sh --signed` and `verify-signature.sh` check:

- **Sign the entry script as the zip carries it**, not `pjsr/` in the
  repository. The version stamp changes code, so a signature made before it
  does not hold.
- **One signature, the entry script's**: `ForaxxPaletteStudio.xsgn` next to
  `ForaxxPaletteStudio.js`. It covers every file the entry script `#include`s,
  recursively (PixInsight's `CodeSigning` documentation, section 6; measured on
  1.9.5: a line of code added to an included file invalidates it). The `lib/`
  files are not signed: their signatures would never be verified, PixInsight
  calls that misleading, and it refuses to sign a file without a `#feature-id`.
  A signing run that signs every `.js` it finds fails here.
- **Re-zip and give `update-package.json` the new sha1.** The site
  authenticates the package by it. `scripts/repro-zip.py` is the layout the
  build uses.
- **No entitlements declared.** The `.xsgn` carries no `<Entitlements>`
  element. The `pjsr.*`/`pcl.*` entitlements `verify-signature.sh` prints are
  the CaeloWorks identity's, from PixInsight's `certified-developers.xcdev`.
- **Comments are not covered.** The signed code is canonicalized, so an edited
  comment leaves the signature valid. Any test that a signature catches
  tampering must change code.
- **A signed zip is not reproducible**: the signature carries a timestamp, so
  every signing gives a new sha1. CI's reproducibility check runs on the
  unsigned build, and release parity is measured on pixels (the parity gate),
  never on the zip's sha1.
- **The keys stay off this repository.** `XSSK_PATH` points to them; the
  password only ever lives in the environment of the PixInsight process that
  signs.
- **The signing machine must allow unsigned scripts.** `sign-package.sh` and
  `verify-signature.sh` drive PixInsight with small PJSR runners that are not
  signed themselves; with *Allow execution of unsigned scripts* off, PixInsight
  refuses them silently and both scripts stop with an error saying so. The
  signed hand gate, which needs the option off, runs separately.
- On WSL, `scripts/pi-run.sh` hands a Windows PixInsight its paths and
  variables (wslpath, WSLENV) and works under the Windows `%TEMP%`.
