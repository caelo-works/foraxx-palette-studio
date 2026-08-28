# 02 — Pipeline and processing (`pjsr/lib/FXProcessing.js`)

Audit date: 2026-08-28. Scope: all 1498 lines except the pure maths helpers assigned elsewhere
(`fxClamp`, `fxMTFValue`, `fxSolveMTF`, `fxScaleCurve`, `fxBlackPointFor`,
`fxMedianAfterBlackPoint`, `fxNormalizationBoost`, `fxChannelTransform`, `fxStretchMapFor`) —
so lines 38–41, 106–147, 241–330 and 422–432 were read for context only. Cross-read
`pjsr/lib/FXPreview.js`, `pjsr/lib/FXExpressions.js`, `pjsr/lib/FXParameters.js`, the Execute and
lifetime paths in `pjsr/lib/FXDialog.js`, `pjsr/ForaxxPaletteStudio.js` and `README.md`.
The node harness was run: `bash tests/run.sh` — 1262 assertions, all passing.

## Executive summary

1. **The one-pipeline invariant holds.** Preview and Execute call the same `fxRenderParts` /
   `fxRenderFinish` with the same expression strings and the same process instances. The only
   differences in `opts` are `show`, `swap`, `refView`, `histogramOf` and which outputs are asked
   for — none of which changes a pixel. Critically, `fxCollectStretch` measures `p.siiView` /
   `p.haView` / `p.oiiiView` (full resolution) in **both** paths, so the 2.3.5 class of fault
   cannot recur through the conditioning map. The only genuine divergences are the two documented
   scale-dependent stages (`HDRMultiscaleTransform`, `UnsharpMask`) plus the layer cap at
   `FXProcessing.js:706-708`, and the README declares both.
2. **Temporary-image lifetime is genuinely well handled.** `fxRenderParts` (1314) and
   `fxRenderFinish` (1348) both `fxCloseCreated` on exception; `fxCloseCreated` (1140-1166) is
   idempotent and also frees the detached `histogramImage`; `fxCreateLuminance` (1004-1039)
   force-closes its own window if the rename fails, before the caller has recorded it; the preview
   transfers `histogramImage` ownership explicitly and frees it on every failure branch; and
   `FXDialog.onHide` / `runFinal`'s `finally` / `main()` each sweep `FXtmp_*`. I found no
   unconditional leak on any reachable exception path.
3. **One High.** `fxValidate` (1083-1093) deliberately re-resolves each view by identifier to
   handle a stale wrapper — and then throws the re-resolved view away. Every consumer
   (`fxCollectIds` 1362, `fxCollectStretch` 1441, `opts.refView` 1490) reads `p.*View` directly, so
   validation can pass on one object while the render uses another. The advertised guard guards
   nothing, and the "validation, not exceptions" invariant is unmet for the exact case the comment
   names.
4. **The 32-bit invariant has no failure mode.** `fxSampleFormat32` (492-498) falls back to
   `SameAsTarget` if `PixelMath.prototype.f32` is missing, silently. On a 16-bit source that ships
   the banded output the architecture doc says must never ship, with no warning and no assertion
   anywhere in the harness.
5. **The console report can overstate what ran, in two places.** `fxApplyHDRMT` (712-715) and
   `fxApplyLocalContrast` (735-736) swallow *every* exception as "unavailable" and continue, while
   `fxReport` (`ForaxxPaletteStudio.js:311-314`) still records the requested layer count and local
   amount. And `created.o` / `created.ho` (1233-1235) are the only outputs never passed through
   `fxRequireView`, so `fxReport:336-339` can announce factor images that PixelMath did not create.
6. **One landmine.** The comment at 847 states "Both sliders default to 0, which is deliberate" and
   argues at length why star brightness on by default is ruinous. The shipped default is
   `starStretch: 1.00` (`FXParameters.js:279`), a 3× hyperbolic lift, intentional per README:150.
   The file that runs the stage documents the opposite of what it does.
7. **`fxViewChannelMedians` (372-410) is dead code** for the background-cast stage removed in 2.5.0,
   and README:399-403 still tells the user to select that mode.

No Critical findings. Counts: High 1, Medium 5, Low 6, Nit 3.

---

## Findings

### High

#### H1. `fxValidate` re-resolves stale view wrappers, then validates a different object from the one the pipeline renders
- **Location:** `pjsr/lib/FXProcessing.js:1083-1093`, consumed at `1362-1379`, `1441-1473`, `1490`
- **Evidence:** inside the validation loop:
  ```js
  // Re-resolve by identifier: the user may have closed the window while
  // this dialog was open, leaving us holding a stale wrapper.
  if ( view != null && !view.isNull )
     view = View.viewById( view.id );
  ```
  `view` is a loop-local. It is never written back to `needed[i][1]`, and never back to
  `p.siiView` / `p.haView` / … The render then reads the parameter store directly:
  `fxCollectIds` returns `p.haView.id`, `fxCollectStretch` calls `fxChannelStats( p.haView )`, and
  `fxRenderFinal` passes `refView: p.haView` straight into `PixelMath.executeOn`. So validation
  inspects the live view found by identifier while the pipeline uses the wrapper the dialog is
  holding. The two agree only when the wrapper is still the live view — which is precisely the
  condition the comment says cannot be assumed.
- **Why it matters:** the reachable workflow is ordinary: the user regenerates a channel outside the
  dialog (re-run a star-removal tool, re-export `H_starless`), which closes the old window and
  opens a new one under the same identifier, and does not press **Reload image list**. If a closed
  view's wrapper still reports its old `id`, `View.viewById` finds the *new* window, validation
  reports no problems, Execute is enabled — and `P.executeOn( p.haView, true )` then fails on a
  null view. The user gets "The render failed: …" in a message box instead of the clear "No image
  selected for Ha." that validation exists to produce. That is the "validation, not exceptions"
  invariant unmet on the path the guard was written for.
- **Fix:** make validation repair the store instead of only reading it. In the loop, after the
  re-resolve, assign back: `needed[i][1] = view;` and, for the six known keys, write the
  re-resolved view into `p` (or return a resolved `{sii, ha, oiii, siiStars, haStars, oiiiStars}`
  map that `fxCollectIds` / `fxCollectStretch` / `fxRenderFinal` consume instead of `p.*View`).
  The second form is preferable because it removes the possibility of the two ever disagreeing
  again.

### Medium

#### M1. The star-finishing comment states a default the code does not have, and argues for it as a safety property
- **Location:** `pjsr/lib/FXProcessing.js:843-856`; default at `pjsr/lib/FXParameters.js:279`
- **Evidence:** the header comment on `fxApplyStarFinishing` reads "Both sliders default to 0, which
  is deliberate. The brightness curve multiplies by 3^k … ruinous for one already stretched, where
  it drives every core to flat white. Having it on by default is what produced exactly that."
  `FX.starStretch` is `1.00`, not 0, so `fxBuildStarStretchExpression` emits
  `((3^1.00)*$T)/((3^1.00-1)*$T+1)` on every default run with stars. Only `starSaturation` is 0.
  README:150 documents the 1.00 default as an intentional 3.0.0 change; README:517 still says "0
  leaves the stars exactly as the combination produced them", which is true of the value 0 but
  reads as a statement about the default.
- **Why it matters:** this is a load-bearing default sitting behind a comment that argues, with a
  regression history attached, that the opposite value is correct. A maintainer reconciling the two
  will change one of them, and changing the default changes every shipped star image. It also
  contradicts the "off by default emits nothing" reading: the star image is unconditionally passed
  through a non-identity PixelMath on a fresh install.
- **Fix:** rewrite lines 847-850 to describe what ships — star colour boost defaults to 0, star
  brightness defaults to 1.00 (a 3× lift chosen in 3.0.0), and the "ruinous" warning applies from
  about k = 5 upward, as README:517 says. Add the default to `tests/parameters.test.js` so the
  value is pinned rather than commented.

#### M2. `fxSampleFormat32` silently degrades the 32-bit float invariant to whatever the source is
- **Location:** `pjsr/lib/FXProcessing.js:492-498`
- **Evidence:**
  ```js
  if ( typeof PixelMath.prototype.f32 != "undefined" )
     return PixelMath.prototype.f32;
  return PixelMath.prototype.SameAsTarget;
  ```
  The comment directly above states the invariant ("Always produce 32-bit floating point output …
  rounding those into a 16-bit integer container introduces visible banding in the low-signal
  transition zones"), then the code provides a fallback that violates it. `SameAsTarget` on a
  16-bit integer Ha source yields a 16-bit starless, a 16-bit `_stars`, 16-bit `_o` / `_ho`, and
  16-bit downsampled preview channels — the whole pipeline. Nothing warns, and no test asserts the
  sample format.
- **Why it matters:** working in 16-bit is common. If the enumerator is ever absent (an older
  1.8.9-era build, the stated support floor), the user gets banded transition zones with no
  indication that the guarantee the architecture doc calls non-negotiable was dropped.
- **Fix:** if `f32` is missing, `Console.warningln` once that 32-bit output is unavailable and the
  result may band, and keep the fallback. Better: also try `PixelMath.prototype.f64` before falling
  through to `SameAsTarget`. Add a harness assertion that `fxPixelMathNew` sets
  `newImageSampleFormat` to the 32-bit enumerator under the shim.
- **Fixed 2026-08-28.** `f32`, then `f64`, then `SameAsTarget` behind a once-a-run
  `Console.warningln` naming the banding. Covered by `tests/processes.test.js`, including the
  assertion on `fxPixelMathNew` — verified by mutation, since removing the `f64` branch or
  repeating the warning both break it.

#### M3. `HDRMultiscaleTransform` and `UnsharpMask` failures are swallowed as "unavailable", and the console report still claims the stage ran
- **Location:** `pjsr/lib/FXProcessing.js:690-717` and `722-737`; report at
  `pjsr/ForaxxPaletteStudio.js:311-314`
- **Evidence:** both stages wrap the whole body — construction *and* `executeOn` — in one
  `catch ( error )` that emits `"HDRMultiscaleTransform unavailable, stage skipped: " + …` /
  `"UnsharpMask unavailable, local contrast skipped: " + …` and returns. A genuine processing
  failure (a mask problem, an out-of-memory on a large frame, a dimension the transform rejects) is
  therefore reported to the user as the process being absent from their installation. Meanwhile
  `fxReport` prints `HDR / contrast ...... compression %.2f above %.2f, %d layers, local %.2f`
  from `FX.hdrLayers` and `FX.localContrast` whenever `hdrEnabled` and any of the three is non-zero
  — it never asks whether the stages actually executed.
- **Why it matters:** the console report is the reproduction record. Re-running it from that record
  will not reproduce the image, because the record says two stages ran that did not. And the
  message sends the user looking for a missing module instead of at the real error.
- **Fix:** have both helpers return a boolean (or push a note onto a per-run list carried on
  `created`), distinguish "constructor threw" (genuinely unavailable) from "executeOn threw"
  (stage failed), and make `fxReport` print the effective values — including the layer count
  actually used after the `affordable` cap at 706-708 — rather than the requested ones.
- **Fixed 2026-08-28.** Both helpers return `{ ran, layers|amount, why }`, with `why` separating
  `"unavailable"` (the constructor threw) from `"failed"` (`executeOn` threw), and each message
  points at the matching place to look. `fxRenderParts` records the effective values on `created`;
  `fxReport` prints those and warns when they differ from what was asked. Covered by
  `tests/processes.test.js` — verified by mutation on the failure returns and on the layer cap.

#### M4. The swap-file policy is inconsistent, and `fxPixelMathNew` writes an undo record against a target it never modifies
- **Location:** `pjsr/lib/FXProcessing.js:540`; contrast with `1006` and `1304`
- **Evidence:** three sites, three answers to the same question.
  - `fxCreateLuminance:1006` — `P.executeOn( src, false );` with the comment "Nothing is written to
    the target, so there is no earlier state to undo to."
  - `fxRenderParts:1304` — `fxApplyStarFinishing( vs, p, false );` with the comment "The image was
    created by PixelMath moments ago and has no earlier state to undo back to, so writing a
    full-frame swap record for each step would cost well over a gigabyte on a large frame and buy
    nothing."
  - `fxPixelMathNew:540` — `P.executeOn( refView, swap );` with `P.createNewImage = true`. On the
    Execute path `swap` is `true` and `refView` is `p.haView`, the **user's own source image**,
    which this call does not write to. It runs up to three times per Execute (`_o`, `_ho`, the
    starless) plus once more against `created.starless` for `_combined` (1338-1341).
  The stated principle at 1006 applies verbatim to 540. It is not applied.
- **Why it matters:** on a deliberately taken path (Execute at defaults on a large frame), the
  script asks PixInsight for undo records for operations that have nothing to undo, against a view
  it does not touch. At best that is wasted swap-file space and a spurious history entry on the
  user's source window; the code itself, twice, treats that cost as worth avoiding. The asymmetry
  is also unexplained on its own terms: the starless output receives roughly ten swap records for
  stages applied to an image created seconds earlier, while the star output receives one.
- **Fix:** pass `false` for the swap argument from `fxPixelMathNew` (`P.executeOn( refView, false )`)
  — creating a new image can never need an undo record on the reference view — and settle the
  starless question explicitly: either drop the swap records there too, with the same reasoning as
  1304, or restore them on the star finishing so the two outputs behave the same. Whichever is
  chosen, state it once and use it everywhere.

#### M5. The `_o` / `_ho` factor images are the only outputs never confirmed, and are emitted on palettes that do not use them
- **Location:** `pjsr/lib/FXProcessing.js:1226-1236`; report at `pjsr/ForaxxPaletteStudio.js:336-339`
- **Evidence:** every other output goes through `fxRequireView` — `created.starless` (1241),
  `created.stars` (1289), `created.combined` (1342), `created.luminance` (inside
  `fxCreateLuminance:1022`). The two factor images do not:
  ```js
  if ( e.o != null )
     created.o = fxPixelMathNew( refView, base + "_o", false, e.o, show, swap );
  if ( e.ho != null )
     created.ho = fxPixelMathNew( refView, base + "_ho", false, e.ho, show, swap );
  ```
  `fxRequireView`'s own comment (1168-1170) explains exactly why this matters: "PixelMath returns
  the identifier we asked for whether or not it managed to use it." `fxReport` then prints
  `Created: <id> (dynamic factor)` unconditionally on a truthy string.
  Separately, `fxBuildExpressions` always returns a non-null `e.ho`, and returns a non-null `e.o`
  whenever a Sii channel is present — including on the fixed palettes, where `p.blend` is held at
  0 and `fxMix` discards both masks. `FXDialog.updateControls` greys the Foraxx amount and the two
  transition sliders on fixed palettes (3.0.1) but leaves `factorsCheck` enabled.
- **Why it matters:** a failed factor render is announced as a success, so the user goes looking for
  an image that is not there. And on SHO / HSO / HOS / OHS / OSH / SOH, ticking the factors box
  produces two greyscale images that had no influence whatsoever on the result, presented in the
  report alongside the images that did.
- **Fix:** wrap both in `fxRequireView`, exactly as the three siblings are. And gate the factor
  images on `fxStyle( p ).dynamic` — either by not emitting them, or by disabling `factorsCheck`
  in `updateControls` next to the amount and transition sliders it already handles.

### Low

#### L1. `fxViewChannelMedians` is dead code for a stage removed in 2.5.0, and the README still recommends that stage
- **Location:** `pjsr/lib/FXProcessing.js:372-410`; `README.md:399-403`
- **Evidence:** `fxViewChannelMedians` is defined and exported nowhere and called nowhere —
  `grep -rn fxViewChannelMedians` matches only its own definition. Its comment says "used by the
  background cast mode"; README:540-541 records that the background-cast correction "was removed in
  2.5.0". README:399-403 nevertheless still reads as live advice: "For the bracketed palettes, use
  the new **Background cast** protection mode … The status line tells you when you have a per-pixel
  mode selected on a palette that cannot produce green or magenta." No such mode and no such status
  line exist.
- **Why it matters:** 39 lines of careful code (detached copy, `finally { image.free() }`, a warning
  on failure) that will be maintained and read as if it ran. A user following README:399 looks for
  a control that is not in the dialog.
- **Fix:** delete `fxViewChannelMedians`. Rewrite README:399-403 to point at Channel normalization,
  which is what actually addresses the bracketed palettes now.

#### L2. `image.median()` is the one statistic in `fxChannelStats` not guarded
- **Location:** `pjsr/lib/FXProcessing.js:163-164`
- **Evidence:** `image.MAD()` (167-174), `image.stdDev()` (176-186) and `image.minimum()`
  (188-197) are each wrapped in `try { … } catch { … = 0 }`, and the non-finite median case is
  handled with a warning. `let median = image.median();` is bare.
- **Why it matters:** if the view dies between validation and the render (the H1 window, or a
  process closing the window from under the dialog), this throws out of `fxCollectStretch` and out
  of `fxRenderFinal` into `runFinal`'s catch. The image is not built, and the message the user gets
  is a raw PJSR error rather than the "leave the channel as it is" degradation every neighbouring
  statistic performs.
- **Fix:** wrap the median in the same `try`/`catch` shape, falling back to the existing non-finite
  branch (warn, treat as 0, return the channel untouched).

#### L3. `fxApplyLocalContrast` makes the bottom eighth of its slider a dead zone and its top unreachable
- **Location:** `pjsr/lib/FXProcessing.js:722-737`, specifically `731`
- **Evidence:** `P.amount = fxClamp( amount * 0.8, 0.10, 1.00 );` with `FXRanges.localContrast`
  = `[0.00, 1.00]`. `amount * 0.8 >= 0.10` only from `amount >= 0.125`, so every value in
  `(0, 0.125)` produces the identical `UnsharpMask` amount of 0.10 — and the step from 0 (nothing
  runs, guard at 724) to 0.001 (amount 0.10) is a discontinuity. At the top of the slider the
  amount reaches only 0.80, so the process's strongest setting is not reachable.
- **Why it matters:** the first eighth of the slider does nothing visible after an abrupt initial
  jump, which reads as a broken control. The comment explains the floor but not that the mapping
  swallows it.
- **Fix:** map the slider onto the usable range instead of clamping into it:
  `P.amount = 0.10 + amount * 0.90;` under the existing `amount <= 0` guard. That makes 0 exactly
  off, small values genuinely small, and 1.00 the process maximum.

#### L4. The `_L` layer is extracted before local contrast and posterisation, so it is not "the lightness of the colour result"
- **Location:** `pjsr/lib/FXProcessing.js:1254-1270`; `README.md:578`
- **Evidence:** the order in `fxRenderParts` is HDR compression and HDRMT (1244-1248) → curves,
  saturation, extra saturation, colour suppression (1249-1252) → **luminance extracted, levelled,
  substituted** (1254-1265) → local contrast (1267-1268) → posterise (1269) → and then the starless
  levels in `fxRenderFinish` (1332). README:578 describes `name_L` as "the CIE L\*a\*b\* lightness
  of the colour result".
- **Why it matters:** with the Warhol style (`posterLevels: 6`) the delivered colour image is
  quantised to six levels per channel and `_L` is continuous — they are not the same image's
  lightness in any useful sense. With HDR on and local contrast raised, `_L` lacks the structure
  the colour image has. Anyone using the exported `_L` for LRGB or as a mask gets a layer that does
  not match. The luminance's own levels are documented as separate (README:585-587); the
  local-contrast and posterise gap is not.
- **Fix:** the extraction cannot move after the substitution, so document it: state in README:578
  that `_L` is taken from the colour image before local contrast and posterisation. If exact
  correspondence is wanted, move `fxApplyLocalContrast` above the luminance block — it is a
  luminance unsharp mask and reads naturally next to the other multiscale stage it belongs to in
  the UI.

#### L5. `fxCollectStretch` runs `fxStretchMapFor` twice per render, duplicating every normalization warning
- **Location:** `pjsr/lib/FXProcessing.js:1441-1450`; call sites at `1493-1494` and
  `FXPreview.js:622-623`
- **Evidence:** both `fxRenderFinal` and the preview build `opts` with
  `stretch: fxCollectStretch( p, false )` **and** `starStretchMap: fxCollectStretch( p, true )`.
  Each call begins with `let map = fxStretchMapFor( p, p.siiView, p.haView, p.oiiiView );`, which
  calls `fxChannelTransform` for all three channels. The pixel statistics are cached so the cost is
  negligible, but the `Console.warningln` calls in `fxChannelTransform:303-310` and
  `fxSolveMTF:127-131` are not deduplicated.
- **Why it matters:** with normalization on and a faint channel, every render emits each warning
  twice — and with auto-preview on that is twice per slider settle. The codebase treats exactly
  this hazard as worth engineering around elsewhere ("which on every slider settle would bury the
  console in warnings", 693-695).
- **Fix:** compute the starless map once per render and pass it into the star variant, e.g.
  `fxCollectStretch( p, stars, sharedMap )`, or memoise `fxStretchMapFor` alongside
  `fxStatsCache` and clear it in `fxClearStatsCache`.

#### L6. `fxStatsCache` is not cleared when the user changes a source view
- **Location:** `pjsr/lib/FXProcessing.js:150-155`; `pjsr/lib/FXDialog.js:589-597`
- **Evidence:** `fxClearStatsCache` is called from `reloadViewLists` (`FXDialog.js:629`), the
  Refresh button (`1254`) and `runFinal` / `fxRenderFinal` (`1570`, `1480`). It is *not* called
  from `sourceChanged`, which is the handler wired to every `ViewList.onViewSelected`. The cache is
  keyed on `view.id`.
- **Why it matters:** selecting a different image is safe (a different id misses the cache). The
  stale case is an identifier whose pixels changed underneath — the user re-stretches `H` in
  PixInsight and comes back. The preview then keeps conditioning against the old median until
  Refresh, Reload or Execute. Execute always re-measures, so no wrong image is shipped; the
  divergence is preview-only and the Refresh tooltip already promises re-measurement.
- **Fix:** add `fxClearStatsCache()` to `sourceChanged`. It costs one re-measure on a deliberate
  user action and removes the only window in which the preview can be conditioned on stale
  statistics.

### Nit

#### N1. Two of the four `PixelMath` construction sites omit four properties the other two set
- **Location:** `pjsr/lib/FXProcessing.js:814-831` and `873-888`; compare `509-541` and `547-568`
- **Evidence:** `fxPixelMathNew`, `fxPixelMathInPlace` and `fxApplyHDRCompression` all set
  `clearImageCacheAndExit`, `cacheGeneratedImages`, `singleThreaded` and `use64BitWorkingImage`
  explicitly. `fxApplyMTFExpression` and the star-stretch block inside `fxApplyStarFinishing` set
  none of them and rely on `new PixelMath`'s defaults.
- **Why it matters:** nothing today — both expressions reference only `$T`, so no generated image is
  cached and the defaults are benign. But these are the two stages that operate on the star image,
  which is where the 2.3.x regressions lived, and "explicit everywhere except here" is how a
  default change in a future PixInsight becomes a mystery.
- **Fix:** set the same four properties at both sites, or factor a small
  `fxNewPixelMath( expression )` helper that all four sites call.

#### N2. `fxApplySaturation` writes two swap records for one logical stage
- **Location:** `pjsr/lib/FXProcessing.js:618-619`
- **Evidence:** `P.executeOn( view, swap ); P.executeOn( view, swap );` — the double pass is
  deliberate and documented (it reproduces the original), but on the Execute path it produces two
  separate undo entries, so undoing the saturation stage takes two Ctrl-Z.
- **Fix:** pass `swap` on the first call and `false` on the second, so the pair collapses to one
  undoable step.

#### N3. `fxValidate` calls any multi-channel image "a colour image"
- **Location:** `pjsr/lib/FXProcessing.js:1100-1103`
- **Evidence:** `if ( view.image.numberOfChannels != 1 )` produces "is a colour image; a single
  channel greyscale image is required." A greyscale image with an alpha channel has
  `numberOfChannels == 2` and is described as colour.
- **Fix:** phrase the message from the count: `… has N channels; a single channel greyscale image is
  required.`

---

## Verification

Each finding was re-attacked: is the path reachable, does a caller already guard it, is the
resource collected elsewhere, does the comment already concede it.

- **H1 — CONFIRMED, with a stated dependency.** The code defect is unambiguous: the re-resolved
  view is a loop-local and every consumer reads `p.*View`. I tried three refutations. (a) *The
  dialog keeps the store fresh.* `reloadViewLists` (`FXDialog.js:620-666`) does re-resolve and
  null out dead wrappers — but only on the Reload button and after an Execute, not on a timer and
  not before a render. (b) *A dead wrapper reports an empty id, so `View.viewById` returns null and
  validation reports correctly.* This is the load-bearing uncertainty and I cannot settle it from
  the repository; if PJSR nulls the identifier the finding collapses to a latent defect. (c) *The
  ViewList would show the new window anyway.* It would not: `getMainViews` is only re-run by
  `reloadViewLists`. Kept at High because the guard the comment advertises is inert regardless of
  (b), the fix is one assignment, and the invariant at stake is named in the brief. If (b) resolves
  favourably, downgrade to Medium.
- **M1 — CONFIRMED, scope corrected.** My first draft framed this as a wrong shipped default. That
  is refuted: README:150 documents the 1.00 default as an intentional 3.0.0 decision, and on real
  stretched star frames (background near zero, since a stars-only frame is original minus starless)
  a 3× hyperbolic lift raises a faint star without raising a floor — the screen-combination hazard
  the comment describes needs a background near 0.25, which stretched star frames do not have. The
  finding stands as a comment/code contradiction on a load-bearing default, not as an image defect.
- **M2 — CONFIRMED as written, severity held.** I looked for a reason the fallback is unreachable.
  `PixelMath.prototype.f32` is, to the best of my knowledge, present in every PixInsight since well
  before the 1.8.9 support floor, so the branch is probably dead — which is why this is Medium and
  not High. It stays Medium because a *silent* fallback out of a stated invariant is the defect
  regardless of how often it fires, and because nothing in `tests/` asserts the sample format, so
  a regression here would ship unnoticed.
- **M3 — CONFIRMED.** I checked whether the report is guarded by the stages having run: it is not
  (`ForaxxPaletteStudio.js:311`, guarded only on `FX.hdrEnabled` and the requested values). I also
  checked whether the preview status line covers it — `FXDialog.js:351` says multiscale stages are
  "approximate at this sampling", which is about sampling, not about a stage having been skipped
  entirely. The layer cap at 706-708 is documented in README:556 for the preview, but the report
  still prints `FX.hdrLayers` for Execute, where the cap is not binding — so that half is
  cosmetic and the "stage did not run at all" half is the real one.
- **M4 — CONFIRMED as an internal inconsistency; the size of the cost is not established.** I could
  not verify from the repository whether PixInsight actually writes a swap record when
  `createNewImage` is true and the target is untouched. If it does not, the concrete cost is zero
  and only the inconsistency remains. The finding is therefore framed on the inconsistency, which
  is verifiable: the file states the governing principle twice (1006, 1300-1303) and does not apply
  it at 540. Held at Medium on that basis, not on an asserted leak.
- **M5 — CONFIRMED, both halves.** The missing `fxRequireView` is a plain omission against a
  four-site pattern. For the fixed-palette half I checked whether the dialog already gates it:
  `updateControls` (`FXDialog.js:1755-1832`) sets `combinedCheck.enabled` from the stars state and
  greys the amount and transition sliders on fixed palettes, but never touches `factorsCheck`. And
  `fxBuildExpressions` does return a non-null `e.ho` unconditionally, so both images are produced.
- **L1 — CONFIRMED.** `fxViewChannelMedians` has no caller anywhere in `pjsr/`, `tests/` or
  `scripts/`; it is not in `tests/run.sh`'s export list either. README:399 is in an explanatory
  section, not in a version-history block, so it reads as current advice — I checked the
  surrounding headings to be sure it was not simply an archived "What's new" entry.
- **L2 — CONFIRMED but narrow.** The throw is caught by `runFinal` and by the preview engine's own
  catch, so nothing leaks and nothing crashes; the finding is that this one statistic degrades
  differently from its three neighbours. Correctly Low.
- **L3 — CONFIRMED by arithmetic.** `FXRanges.localContrast` is `[0.00, 1.00]`
  (`FXParameters.js:548`), and `0.125 * 0.8 = 0.10` exactly, so the dead zone is `(0, 0.125)`.
  Verified that the `amount <= 0` early return at 724 keeps 0 a true no-op, so the discontinuity is
  real rather than a continuous ramp from the floor.
- **L4 — CONFIRMED, severity reduced from my initial Medium.** The luminance must be extracted
  before its own substitution, so no ordering fixes everything; and excluding posterisation from a
  luminance layer is arguably correct. What survives is a documentation mismatch with a real
  user-visible consequence for the exported `_L`. Low.
- **L5 — CONFIRMED, severity reduced.** I initially wrote this as a console flood. Re-checking
  `fxChannelTransform`, the warning fires only when `xm <= 0`, i.e. a channel with nothing above
  its black point — pathological, not routine. `fxStatsCache` also means the duplicate work costs
  nothing measurable. Low.
- **L6 — CONFIRMED, severity reduced.** My first pass had this as stale statistics reaching the
  final image. Refuted: `fxRenderFinal:1480` and `runFinal:1570` both call `fxClearStatsCache`
  before every Execute, so no wrong image can ship. Selecting a *different* view is also safe,
  since the cache is keyed on identifier. The residue is a preview-only staleness window after an
  external edit, recoverable with Refresh. Low.
- **N1, N2, N3 — CONFIRMED as written.** N1 has no behavioural consequence today and is filed as
  consistency only. N2 is a UX detail of the undo stack, and depends on the same swap-record
  question as M4. N3 is wording.

**Refuted and dropped during the adversarial pass:**

- *`fxCollectIds` uses `view.id` rather than `view.fullId`, so a selected preview would produce a
  PixelMath expression that resolves to the wrong image.* Refuted: `reloadViewLists` populates the
  lists with `list.getMainViews()` (`FXDialog.js:647`), so previews can never be selected, and
  `ViewList.excludeIdentifiersPattern` additionally hides `FXtmp_*` (548, 564).
- *`fxReport` can name a normalization reference channel that the pipeline did not use, because
  `fxStretchMapFor:344` silently rewrites `ref` from Sii to Ha on a palette without Sii.* Refuted:
  `FXDialog.updateControls:1815-1829` writes `FX.normalizeRef = 1` and syncs the combo whenever
  `!needsSii`, before any render, so the store and the report already agree and the fallback in
  `fxStretchMapFor` is belt-and-braces.
- *The preview leaks a hidden `FXtmp_out*` window on every failed render.* Refuted:
  `fxRenderParts:1310-1316` and `fxRenderFinish:1345-1350` both `fxCloseCreated` on exception,
  `FXPreviewEngine.render` calls `fxCloseCreated( outIds )` unconditionally after its try/catch
  (`FXPreview.js:656`), and `onHide` plus `main()` both run `fxSweepTemporaries` as a backstop.
- *The detached `histogramImage` leaks when `fxRenderFinish` throws after the preview has taken
  ownership.* Refuted: the preview nulls `outIds.histogramImage` *before* calling
  `fxRenderFinish` (`FXPreview.js:630-631`) and frees `histogramSource` itself on every branch
  where `image == null` (`658-670`), and `FXDialog.refreshPreview` frees it again in a `finally`
  after handing it to the histogram control (`FXDialog.js:311-321`).
- *The preview and Execute disagree on the star channels, as in 2.3.5.* Refuted: `fxCollectStretch`
  measures `p.*View` — the full-resolution sources — in both paths, `FXPreviewEngine.makeChannel`
  downsamples the star channels with `IntegerResample.prototype.Maximum` and reads the property
  back to confirm it was honoured, and `FXDialog.js:356-361` warns in the status line when it was
  not. The invariant is actively defended.
- *`fxApplyLuminance` is applied in the preview but not in Execute, or vice versa.* Refuted: both
  gate on `p.makeLuminance` at `FXProcessing.js:1263`; `opts.luminance` only forces the layer to be
  *built* for the preview's Luminance target, matching README:588.
- *`fxUniqueBaseId` can miss a suffix and break the matching-group invariant.* Refuted: its
  `SUFFIXES` list (`64`) covers every suffix the pipeline emits — `""`, `_stars`, `_combined`,
  `_o`, `_ho`, `_L` — and `tests/naming.test.js` pins the group behaviour across 58 assertions.
- *`fxSweepTemporaries` could destroy a user's own image.* Technically true for an image the user
  named `FXtmp_*`, but `fxValidate:1116-1121` reserves the prefix with an explicit message and the
  ViewLists exclude it. Not worth filing.
