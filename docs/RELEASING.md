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

7. The Release workflow attaches `dist/ForaxxPaletteStudio-X.Y.Z.zip` +
   `update-package.json`.

8. **Notify the site agent**: comment on the tracking issue in
   `caelo-works/pixinsight-scripts` with the release URL, the zip **sha1** (from the
   published `update-package.json`, not your local build), and `piVersionRange`.

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

Off, deliberately. `build-update-package.sh` signs only when `XSSK_PATH` is set,
and the site's ingest **refuses** any zip containing a `.xsgn` while the
CaeloWorks CPD identity is not published in `certified-developers.xcdev`: a
signature made with a local identity is rejected on every other machine, which
is worse than no signature. Until then PixInsight shows an "unsigned repository"
warning on the shared repository, which is expected and affects every CaeloWorks
script equally.
