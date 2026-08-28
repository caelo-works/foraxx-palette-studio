# 05 — Preview, histogram and layout (`FXPreview.js`, `FXHistogram.js`, `FXSplitter.js`)

Audit date: 2026-08-28. Scope: `pjsr/lib/FXPreview.js` (695 lines), `pjsr/lib/FXHistogram.js`
(458 lines), `pjsr/lib/FXSplitter.js` (149 lines) — every line read. `pjsr/lib/FXProcessing.js`,
`pjsr/lib/FXDialog.js` and `pjsr/lib/FXParameters.js` were cross-read as reference; three findings
below land in `FXDialog.js` and are marked as such, because they are the mechanism behind claims
this audit was asked to verify. I ran `tests/run.sh` (1262 assertions, all pass — it does not cover
these three files, which the architecture doc says are hand-verified in PixInsight) and a
standalone Node probe that transcribes the zoom-anchor arithmetic, the marker hit test, the log
scale and the auto sampling factor, to check them numerically rather than by eye.

## Executive summary

1. **The one-pipeline invariant holds.** The preview builds no expression, runs no process and
   computes no pixel of its own. `FXPreviewEngine.render` (`FXPreview.js:566-673`) calls the same
   `fxRenderParts` / `fxRenderFinish` pair as `fxRenderFinal`, with the same `stretch` and
   `starStretchMap` maps — and those maps are measured on the **full resolution** source views in
   both paths (`FXProcessing.js:1441-1469`), not on the downsampled copies. The downsampled copies
   are identity PixelMath duplicates (`FXPreview.js:473`), so they carry no conditioning of their
   own. I could not find a second code path anywhere in scope.

2. **The 2.3.5 peak-first fix is real and complete.** `makeChannel(..., peaks)`
   (`FXPreview.js:470-506`) is called with `peaks = true` for all three star channels and only for
   them (`FXPreview.js:545-547`); the nebula channels get `false` (`529-531`). Those are the only
   two channel sets the pipeline consumes, so there is no third star path that was missed. The
   request is genuinely read back before being believed (`491-492`), and a refusal reaches the
   status line. One narrow hardening gap in the read-back — L7.

3. **The zoom arithmetic is correct, and I verified it numerically.** `originAtZoom`
   (`FXPreview.js:124-129`) and the paint offset (`344-345`) are the same expression, so the anchor
   inversion at `193-194` is exact. Over twelve consecutive `×1.25` notches my transcription of
   `zoomAbout` held the anchored pixel to **0.500 px maximum screen drift, non-accumulating** — the
   `Math.round` on the scroll position is the whole of the error and it does not compound. Panning
   is clamped correctly and cannot push the image out of the panel. No off-by-one found.

4. **Four High findings.** Two of them are documented behaviours that are absent: the star channel
   set is thrown away and re-resampled on *every* starless render, so the README's "cached
   independently" is half false (H2); and a status-line note assignment uses `=` where every other
   uses `+=`, silently deleting the 2.7.0 "levels in force elsewhere" warning and the "THESE
   CHANNELS LOOK LINEAR" warning whenever HDR is on (H4). The third is a preview that shows stale
   pixels after a source image is edited, which **Refresh does not fix** despite advertising that it
   does (H1). The fourth is an unbounded hidden-image leak on the `makeChannel` exception path (H3).

5. **One genuine preview-vs-Execute divergence that is nobody's bug but is undocumented** (M1): the
   peak-first downsampling that makes the star *stretch* exact necessarily makes the star
   *histogram* wrong — max-pooling a 1:8 block lifts the background to roughly mean + 2.5σ. A black
   point placed by eye or by **Auto** on the Stars target is therefore set against a distribution
   several noise sigma brighter than the one Execute will apply it to.

6. **The histogram maths is sound.** `log(0)` is guarded (`FXHistogram.js:416`), the peak seed of 1
   makes division safe, the median accumulator's `total * 3` correctly matches the tripled combined
   distribution, `valueToX` and `xToValue` are exact inverses, and the padding of 11 px is provably
   wide enough for an 8 px half-width marker at value 0 or 1 — nothing clips. Marker ordering cannot
   be inverted from the UI. The only real defect in the widget is a hit test whose precedence is the
   exact inverse of the comment above it (L1).

7. **`FXSplitter.js` is clean.** The global-coordinate anchor is the right call and the comment
   explaining why is accurate; the sizes persist because `main()` saves settings unconditionally on
   close. Two cosmetic nits only.

No Critical findings. Counts: High 4, Medium 3, Low 8, Nit 5.

---

## Findings

### High

#### H1. Editing a source image leaves the preview showing stale pixels, and **Refresh** does not fix it

- **Location:** `pjsr/lib/FXPreview.js:515-556` (`ensureChannels`, the cache key), with
  `pjsr/lib/FXDialog.js:1251-1256` (the Refresh button).
- **Evidence:** the downsampled copies are keyed on `[ factor, src.sii, src.ha, src.oiii ]`
  (`FXPreview.js:523`, `537-538`) — the sampling factor and the source **identifiers**. Nothing in
  the key describes the source *pixels*. Modify a source image in PixInsight while the dialog is
  open (re-stretch Ha, run an SCNR on Oiii, apply a mask) and the key is unchanged, so
  `ensureChannels` short-circuits and every later preview renders from copies taken before the
  edit. The Refresh button's tooltip says "Re-render the preview now, **re-measuring the sources**",
  but its handler only calls `fxClearStatsCache(); dlg.refreshPreview();` — it clears the *statistics*
  and reuses the *stale copies*. Execute has no such problem: `fxRenderFinal` clears the stats cache
  and reads the live views. The only controls that actually drop the copies are **Reload image
  list** (`FXDialog.js:628`) and an Execute (`1584`), neither of which says it will.
- **Why it matters:** the preview shows one image and Execute produces another, from a workflow
  that is entirely normal — tune a channel, come back to the palette. The affordance that looks
  like the fix is not the fix, so a user who notices something is wrong and presses Refresh gets
  the same wrong picture back and concludes the palette is at fault. This is the same failure shape
  as the 2.7.0 stale-markers bug the README calls out.
- **Fix:** make Refresh drop the copies as well as the statistics —
  `this.engine.release(); fxClearStatsCache(); dlg.refreshPreview();` at `FXDialog.js:1253-1255`.
  If a cheap guard against a *silent* stale preview is also wanted, fold a content signature into
  the key: `fxChannelStats( view ).median` is already computed for every source when normalization
  is on, and `view.image.median()` is one pass otherwise — appending it to the join at
  `FXPreview.js:523` and `537` invalidates the cache when the pixels move.

#### H2. The star channel set is destroyed on every starless render, so the documented independent caching does not exist in that direction

- **Location:** `pjsr/lib/FXPreview.js:537-553`.
- **Evidence:** `render` passes `needStars = (p.previewTarget == 1)` (`577`, `593`). With the target
  on Starless or Luminance, `srcStars` is `null` (`519`), so `starsKey` becomes the sentinel `"-"`
  (`537`). If a star set was cached its key was something like `"6|Sii_s|Ha_s|Oiii_s"`, so
  `starsKey != this.starsKey` is true and line 541 calls `releaseStars()` — force-closing three
  perfectly good downsampled star copies that nothing asked it to discard. Going back to Stars
  rebuilds all three from scratch: three full PixelMath duplications of the source plus three
  `IntegerResample` executions. The starless set is not treated this way, because
  `fxCollectIds( p, false )` never returns `null`, so `starlessKey` never degenerates to a sentinel
  and the starless copies survive a stars render. The asymmetry is not deliberate: the comment at
  `509-514` only claims the starless direction, but README "The preview" states the symmetric
  promise — "Starless and star channel sets are cached independently, so switching the preview
  target does not resample anything it does not have to."
- **Why it matters:** every Starless → Stars → Starless → Stars cycle pays the full star resampling
  twice. On a 9576 × 6388 frame at Detail 1:1 that is three full-resolution 32-bit duplications per
  switch — gigabytes of allocation and seconds to tens of seconds of wall clock, on the one gesture
  the README promises is free. Comparing the nebula against the stars is the normal way to use this
  panel.
- **Fix:** only release when the set is genuinely superseded, and leave it alone when this render
  simply does not need it:

  ```js
  if ( srcStars != null )
  {
     let starsKey = [ factor, srcStars.sii, srcStars.ha, srcStars.oiii ].join( "|" );
     if ( starsKey != this.starsKey || this.starIds == null )
     {
        this.releaseStars();
        ... build ...
        this.starsKey = starsKey;
     }
  }
  // needStars false: keep whatever is cached, it is still valid
  ```

  The set is still reclaimed on `release()` — `reloadViewLists`, Execute and `onHide` all call it —
  so nothing outlives the dialog. Note this also makes the factor change (Detail) the thing that
  invalidates it, which is the correct trigger.

#### H3. Hidden temporary images leak, unbounded, whenever `makeChannel` throws

- **Location:** `pjsr/lib/FXPreview.js:526-535` and `540-553`.
- **Evidence:** the local `list` is handed to each `makeChannel` call, which pushes the new
  identifier into it (`472-474`), but `list` is only installed on the engine **after all three
  calls have returned**:

  ```js
  this.releaseStarless();            // starlessTemps := []
  let list = [];
  this.channelIds = {
     sii:  ... this.makeChannel( p.siiView, factor, "sii", list, false ).id ...,
     ha:   this.makeChannel( p.haView,   factor, "ha",   list, false ).id,
     oiii: this.makeChannel( p.oiiiView, factor, "oiii", list, false ).id
  };
  this.starlessTemps = list;         // never reached if any call above throws
  ```

  If the second or third `makeChannel` throws — PixelMath failing to allocate at Detail 1:1 on a
  large frame is the obvious case, and `IntegerResample.executeOn` at `499` is another — the one or
  two windows already created are referenced only by the orphaned `list`. `this.starlessTemps` is
  still `[]`, so `releaseStarless()` will never close them. `render`'s catch (`650-654`) records the
  message and returns; it does not call `release()` (only the dead-`refView` branch at `601` does).
  `this.starlessKey` was never updated either, so the next auto-preview tick retries, and
  `fxUniqueViewId` hands out `FXtmp_sii01`, `FXtmp_sii02`, … — fresh orphans each time. The stars
  branch has the identical structure at `544-550`.
- **Why it matters:** the failure modes that reach here are the recurring kind. With **Auto**
  preview on, a 0.4 s timer retries after every control settle, so an out-of-memory at Detail 1:1
  accumulates two hidden full-resolution 32-bit images per attempt for as long as the user keeps
  touching controls — the exact "one hidden image per keystroke" leak that `fxRenderParts` and
  `fxCloseCreated` were carefully written to prevent on the other side of the same engine. The
  README's "All temporary images are hidden and closed when the dialog closes" does still hold, via
  `fxSweepTemporaries` (`FXPreview.js:678-693`) on `onHide` — but "closed at the end" is no comfort
  when the leak is what caused the failure.
- **Fix:** install the array before anything is put in it — it is a reference, so the engine sees
  every push:

  ```js
  this.releaseStarless();
  let list = [];
  this.starlessTemps = list;   // adopt now, so a throw still leaves them reclaimable
  this.channelIds = { ... };
  this.starlessKey = starlessKey;
  ```

  Same two-line move in the stars branch. Belt and braces, add `this.release()` to `render`'s catch
  at `650-654` so a failed render never leaves a half-built set behind.

#### H4. The HDR status note **overwrites** the levels-elsewhere and linear-input warnings instead of appending

- **Location:** `pjsr/lib/FXDialog.js:352` (outside this audit's three files, but it is the delivery
  mechanism for two claims this audit was asked to verify).
- **Evidence:** `updatePreviewStatus` builds one `note` string by appending — `note +=` at 345, 349
  and 359. Line 352 alone reads:

  ```js
  if ( FX.hdrEnabled && (FX.hdrLayers > 0 || FX.localContrast > 0) )
     note = "  -  multiscale stages are approximate at this sampling";
  ```

  A bare `=`. Anything accumulated before it is discarded, so with the HDR section on and either
  slider off zero, both the 2.7.0 warning "levels also in force on: …" (345) and the all-caps
  "THESE CHANNELS LOOK LINEAR" warning (349) vanish from the status line. Only the star-peaks note
  at 359 survives, because it appends afterwards.
- **Why it matters:** README 2.7.0 states "**The status line names any set that is in force but not
  on screen**, so a black point you can't currently see can't silently shape what you build." That
  is the entire mitigation for the bug 2.7.0 was written to fix, and it is switched off by an
  unrelated checkbox. The linear-input warning is the script's only explanation for a black preview,
  and README "What it expects" leans on it. Both are absent in a realistic configuration — HDR on
  is a first-class documented feature.
- **Fix:** `note += "  -  multiscale stages are approximate at this sampling";`

### Medium

#### M1. Peak-first downsampling makes the star histogram — and therefore **Auto** on the Stars target — read against a distribution the real image does not have

- **Location:** `pjsr/lib/FXPreview.js:470-506` (`peaks = true` path) feeding
  `FXPreview.js:616-617` (`histogramOf: "stars"`) and `FXHistogram.js:214-228` (`autoValues`).
- **Evidence:** the 2.3.5 fix is correct and this finding does not dispute it: because the stretch
  is strongly non-linear, `f(mean) ≠ mean(f)` and max-pooling is the only way to keep a star's peak.
  But the same max-pooling is applied to the *background*, and the histogram the user drags markers
  on is computed from that max-pooled image (`FXProcessing.js` `capture("stars", …)`, taken after
  the star finishing and before `fxApplyStarLevels`). Max over a 1:8 block is a max over 64 samples;
  for Gaussian background noise that sits at roughly mean + 2.5σ, and the whole low end of the
  drawn distribution shifts right by that amount with no counterpart in the full-resolution image.
  `autoValues` then takes the 0.05 % quantile of the shifted distribution (`219`) and hands it
  straight to `starLevelsLow`. Execute applies that black point to the *un*-pooled image, whose
  faint end extends well below where the preview showed it.
- **Why it matters:** the black point clips more of the real star frame than the preview showed it
  clipping, losing faint stars — and it does so silently, because the previewed image is pooled the
  same way and therefore looks self-consistent. Nothing in the README, the CHANGELOG or the
  tooltips mentions that the star histogram is biased; the status line only speaks when peak-first
  was *refused* (`FXDialog.js:356-360`), which is the opposite case. This is a real
  preview-vs-Execute divergence, and it is the only one I found that the docs do not already own.
- **Fix:** it cannot be fixed by changing the render without breaking the 2.3.5 invariant, so make
  it visible and make **Auto** honest. Minimum: extend the star-peaks status note to fire when peaks
  *were* honoured and the factor is greater than 1 — "star peaks are preserved for the stretch, so
  the star histogram sits brighter than the full-resolution one; set the black point at Detail 1:1".
  Better: have `autoValues` on the Stars target take its `low` from the full-resolution source
  instead of the pooled preview — `fxChannelStats( p.haStarsView ).minimum` and `.median` are
  already computed and cached, and the black point is exactly the statistic that must not come from
  a pooled image.

#### M2. `new Graphics()` is constructed outside the `try` in two of the three paint handlers, so a construction failure throws twice out of a paint

- **Location:** `pjsr/lib/FXHistogram.js:363` and `452`; `pjsr/lib/FXSplitter.js:112` and `143`.
- **Evidence:** `FXPreview.js:326-361` gets this right and documents precisely why:

  > Constructed inside the try: if `Graphics` itself throws, `g` is undefined and the `g.end()`
  > below would throw a second time out of a paint handler, which is precisely what the catch is
  > here to prevent.

  The other two files did not receive the same treatment. Both open with `let g = new Graphics( this );`
  *before* the `try`, and both end with an unguarded `g.end();` after the `catch`. If the
  constructor throws, nothing catches it; if the body throws after a successful construction the
  `catch` swallows it correctly, so only the construction case is exposed.
- **Why it matters:** an unhandled exception out of a paint handler is exactly the failure the two
  `catch` blocks exist to prevent, and the histogram is repainted on every mouse-move during a
  drag. Low probability, but the mitigation is already written down one file over and was simply not
  applied here.
- **Fix:** mirror `FXPreview.js:326-361` in both — `let g = null;` outside, `g = new Graphics( this );`
  as the first statement inside the `try`, and `if ( g != null ) g.end();` at the end.

#### M3. A single click within 10 px of a levels marker moves it, with no undo and no way to click without moving

- **Location:** `pjsr/lib/FXHistogram.js:293-302`.
- **Evidence:** `onMousePress` calls `markerAt( x )` and, if anything is within the 10 logical-pixel
  tolerance (`241`), immediately calls `applyDrag( x )` — which snaps that marker to the click
  position — and notifies. There is no grab-without-move path: pressing 9 px to the right of the
  black point does not pick the black point up where it is, it teleports it 9 px, which at a typical
  578 px span is a black point change of about 0.016. The value is written straight into `FX` by
  `onValueChanged` (`FXDialog.js:1324-1332`) and there is no undo for the levels sets.
- **Why it matters:** a stray click anywhere near the marker strip silently changes a levels value
  that will be applied at Execute. The `levelsReadout` shows the new number, but nothing marks it as
  accidental, and the README's model — "Drag the three triangles" — does not suggest that a click is
  itself a drag.
- **Fix:** in `onMousePress`, set `dragIndex` and the cursor but do **not** call `applyDrag` /
  `notify`; let the first `onMouseMove` start moving it. Users who want click-to-position keep it
  for clicks outside the tolerance if you also add an `else` branch that jumps the nearest marker —
  but the safe default is grab-in-place.

### Low

#### L1. `markerAt`'s tie-breaking is the exact inverse of the comment above it

- **Location:** `pjsr/lib/FXHistogram.js:246-262`.
- **Evidence:** the comment states the intent —

  > Test the midtones marker first and let a later candidate win a tie. Drag the midtones onto the
  > black point with a strict first-wins scan and it can never be picked up again.

  With `ORDER = [ 1, 0, 2 ]` and the non-strict `if ( d <= bestDistance )`, "later wins a tie" means
  the **last** candidate examined wins, i.e. the priority order is high, then low, then **midtones
  last** — precisely the marker the comment wants protected. I transcribed the function and ran it:
  with `mid` at its 0.001 floor the two markers sit 0.578 px apart, and a click at or to the left of
  the pair returns the **black point**, not the midtones. Mirrored at the top, `mid = 0.999` sitting
  on the white point, a click at or to the right returns the white point.
- **Why it matters:** less than the comment fears — the same probe shows the midtones is still
  reachable by clicking on the side it leans toward (0.578 px away is enough to win), so it never
  becomes permanently unreachable. But combined with M3 the miss is not free: aiming for the pinned
  midtones and clicking a pixel the wrong way grabs the black point *and* drags it to the cursor.
- **Fix:** either make the scan strict (`if ( d < bestDistance )`, which gives the comment's
  intended midtones-first priority) or keep `<=` and reorder to `ORDER = [ 0, 2, 1 ]`. Either way,
  update or delete the comment so it describes what the code does.

#### L2. The wheel dead-ends at `minZoom` and cannot return to a Fit scale below it

- **Location:** `pjsr/lib/FXPreview.js:174-188`.
- **Evidence:** the widening at `180-181` uses the *current* scale — `lo = Math.min( this.minZoom, z0 )`
  — which is right in Fit but not once Fit has been left. Probe, 9576 × 6388 in a 900 × 700 panel:
  the Fit scale is 0.0940; wheeling out while fitted correctly does nothing (`false`, Fit survives,
  as the comment at `183-186` intends); one notch in reaches 0.1175 and leaves Fit; then wheeling
  out gives `0.1000` and every subsequent notch returns `false`. The user is parked at 0.10 and the
  wheel is dead, 6 % above the scale they started from.
- **Why it matters:** README says "one notch multiplies the scale by 1.25 or 0.8" without
  qualification, and the wheel stops obeying that near the boundary. It is recoverable — a double
  click returns to Fit, which is documented and works — so this is a rough edge rather than a trap.
- **Fix:** widen against the fit scale rather than the current one:
  `let fit = this.fitScale(); let lo = Math.min( this.minZoom, fit );` where `fitScale()` is
  `effectiveZoom()`'s fit branch factored out. Wheeling out then walks back down to the fit scale
  and re-enters Fit when it reaches it.

#### L3. "zooming in to 200 % is still pixel exact" does not match the percentage the UI shows

- **Location:** `pjsr/lib/FXPreview.js:428-429` (the comment), echoed in README "The preview" and in
  the Detail tooltip at `FXDialog.js:1226-1228`.
- **Evidence:** `zoomFactor`'s auto branch (`441-445`) uses `OVERSAMPLE = 2` under a `Math.ceil`, so
  the render is *at most* twice the panel and usually less. Probe, 900 × 700 panel: 4000 × 3000
  renders at 1:3 → 1333 px → Fit reads **68 %**; 9576 × 6388 renders at 1:6 → 1596 px → Fit reads
  **56 %**; 1200 × 900 renders at 1:1 → Fit reads **75 %**. In every case the render is shown one
  screen pixel per rendered pixel — the pixel-exact point — when the readout says **100 %**, not
  200 %. Above 100 % the Graphics transform interpolates. The `Math.ceil` guarantees Fit is above
  50 %, so "200 %" is never the right number for any frame.
- **Why it matters:** a user following the README will zoom to a readout of 200 % believing they are
  looking at exact pixels and will in fact be looking at a 2:1 magnification of them — which matters
  precisely when they are inspecting stars, the thing the panel is hardest to judge.
- **Fix:** say 100 %. "Auto renders at about twice the panel resolution, so the readout can reach
  100 % — one screen pixel per rendered pixel — with detail left to spare above Fit." Update the
  comment, the README bullet and the Detail tooltip together.

#### L4. A greyscale image's histogram is drawn three times and comes out blue

- **Location:** `pjsr/lib/FXHistogram.js:62`, with the paint loop at `403-428`.
- **Evidence:** `image.sample( x, y, (k < nc) ? k : (nc - 1) )` — for the Luminance target `nc` is 1,
  so `k = 0, 1, 2` all read channel 0 and `c[0]`, `c[1]`, `c[2]` are identical. The paint loop draws
  red, then green, then blue over the same path, so the visible curve is whichever is painted last:
  blue.
- **Why it matters:** README says the histogram is drawn "as one outline per channel". For the
  luminance layer there is one channel and the user gets a blue outline, which reads as a colour
  channel rather than as lightness. Cosmetic, but it is the one target where the drawing is
  actively misleading about what it is showing.
- **Fix:** in `fxComputeHistogram`, return `nc` on the result; in `onPaint`, when `hist.nc == 1`,
  draw a single outline in a neutral brush (`0xffc8c8c8`) instead of the three.

#### L5. The strided sampling under-represents exactly the population the Stars target is about

- **Location:** `pjsr/lib/FXHistogram.js:52-70`.
- **Evidence:** `step = max( 1, round( sqrt( w*h / 120000 ) ) )` caps the work at roughly 120 k pixel
  reads — except at the rounding boundary: `w*h = 180000` gives `sqrt(1.5) = 1.22 → step 1`, so
  180 000 pixels × 3 channels = 540 000 `Image.sample()` calls on the UI thread, 1.5× the intended
  cap. More importantly, a stride of 2 or 3 samples one pixel in 4 or 9, and stars occupy a tiny
  fraction of a star frame, so the bright tail of the drawn star histogram is sampled far too
  sparsely to be trustworthy — the white point looks mis-set because the data that would justify it
  was skipped.
- **Why it matters:** performance is minor; the accuracy loss lands on the Stars target, where the
  drawn histogram is already the hardest thing to read (see M1).
- **Fix:** PJSR's `Image.histogram()` computes an exact histogram in native code, over every pixel,
  faster than 120 k scripted `sample()` calls. Use it where available and keep the strided loop as
  a fallback in the existing `catch`.

#### L6. A failed render leaves the previous image's histogram on screen

- **Location:** `pjsr/lib/FXDialog.js:302-305` (the `result == null` branch), against
  `FXPreview.js:566-673`.
- **Evidence:** the validation branch at `FXDialog.js:264-268` clears both —
  `setImage( null )` *and* `setHistogram( null )`. The render-failure branch at 302-305 clears only
  the image. The panel therefore shows an empty preview above a fully drawn histogram belonging to
  whatever last succeeded.
- **Why it matters:** the whole point of 2.7.0 is that the histogram belongs to the image on screen.
  When there is no image on screen the histogram belongs to nothing, and its markers are still live
  and still writing to `FX`.
- **Fix:** add `this.levels.setHistogram( null );` alongside the `setImage( null )` at 303.

#### L7. The `downsampleMode` read-back cannot distinguish "honoured" from "the constant does not exist"

- **Location:** `pjsr/lib/FXPreview.js:489-497`.
- **Evidence:** the read-back is `honoured = (R.downsampleMode == IntegerResample.prototype.Maximum)`.
  The guard is well judged and almost certainly correct in practice — PJSR process parameters are
  typed, so reading `downsampleMode` returns a Number and a Number never `==` `undefined`. But *if*
  the enumeration constant were absent under some build or version, the assignment would store
  `undefined` (or coerce), the comparison would become `undefined == undefined` → **true**, and the
  status line would assert that peaks were preserved on a run that averaged them. That is the one
  outcome the comment at `486-488` says must be avoided.
- **Why it matters:** the whole mechanism exists because "PixInsight's downsample mode is not
  something this codebase could confirm against a shipping script" (README 2.3.5). A guard built for
  an unconfirmed API should not have an unchecked assumption at its centre.
- **Fix:** one line before the assignment —
  `if ( typeof IntegerResample.prototype.Maximum == "undefined" ) honoured = false; else { … }` —
  or assert the constant is a number as part of the comparison.

#### L8. README's "closing with Close leaves your previous settings alone" is false, and it is what makes the documented splitter persistence work

- **Location:** `pjsr/ForaxxPaletteStudio.js:371-375`, against README "Other notes" and README
  "Layout".
- **Evidence:** README "Other notes" says "Only a run you accept with **Execute** becomes the new
  stored default; closing with **Close** leaves your previous settings alone." The entry point does
  the opposite, and its comment says so explicitly: "Whatever happened in there, the settings the
  user left behind are the ones they want next time — a session spent tuning and then closed
  without an Execute must not be thrown away", followed by an unconditional `fxSaveSettings()`.
  `sideBarWidth` and `histogramHeight` are both in the persisted key list
  (`FXParameters.js:514-515`), which is exactly why README "Layout"'s "Both sizes are remembered
  between sessions" is true — the splitter code itself (`FXSplitter.js`) is correct and the dialog
  wiring at `FXDialog.js:1437-1484` is correct.
- **Why it matters:** the two README statements contradict each other, and a user relying on "Close
  discards" to abandon an experiment will find it kept. The code's behaviour is the better one;
  the docs are what is wrong.
- **Fix:** rewrite the "Other notes" bullet to match the code — settings always persist on close,
  and **New Instance** is what captures a snapshot into a process icon.

### Nit

#### N1. `logScale` is a field nothing ever writes

`FXHistogram.js:143` declares `this.logScale = true` and `417` branches on it. Nothing anywhere
sets it to `false`, and the README commits to a logarithmic scale. Either expose it (a context-menu
toggle) or delete the field and the branch.

#### N2. The splitter grip is drawn 3 px off centre

`FXSplitter.js:124` and `133` start the grip at `centre − 12`, but five marks at a 6 px pitch with a
3 px mark span 27 px, so the run ends at `centre + 15`. Start at `centre − 13` (or use four marks)
to centre it.

#### N3. Both double-click handlers, and the preview's mouse-press, accept any button

`FXSplitter.js:92-96` resets the split on a double click from any button, and
`FXPreview.js:245-251` begins a pan drag on any button — including right-click, which on some
window managers is also the context-menu gesture. `FXSplitter.onMousePress` already filters on
`MouseButton_Left` (`68`); apply the same filter to the other three.

#### N4. The histogram's last column sits one pixel left of `valueToX( 1 )`

The paint loop runs `px` over `[0, span)` so the rightmost column occupies `pad+span-1 … pad+span`,
while the white-point guide line at value 1.0 is drawn at `pad+span` (`FXHistogram.js:406`, `434`).
A one-pixel gap between the end of the distribution and the marker that is supposed to sit on it.
Run the loop to `px <= span` or accept it.

#### N5. `makeChannel`'s `peaks` return value is meaningless for the nebula channels

`FXPreview.js:477`, `503`: `honoured` is initialised `false` and the `else` branch returns
`peaks ? true : false`, so a nebula channel always reports `peaks: false` — "peaks were not
preserved" for a channel that never asked. Nothing reads it (`529-531` take `.id` only), so this is
harmless, but the field would be misread by the next person. Also at `481`: if the window lookup
fails, `honoured` stays `false` and the status line claims averaging, when in fact *nothing was
resampled at all* and the copy is full resolution — while `this.factor` still reports "rendered at
1:N". Return a third state, or name the field `peaksRequested` / `peaksHonoured` explicitly.

---

## Verification

Each finding was attacked before it was written down. What follows is the outcome per finding,
including the four candidates that did not survive.

- **H1 — CONFIRMED.** Read `ensureChannels` against `FXDialog.js:1251-1256` line by line. The
  Refresh handler calls `fxClearStatsCache()` and `refreshPreview()`; `refreshPreview` calls
  `engine.render`; `render` calls `ensureChannels`; the key at `523` is unchanged by a pixel edit,
  so line 524's condition is false and the stale copies are reused. Tried to refute it by looking
  for any other invalidation: only `engine.release()` clears the copies, and it is called from
  `reloadViewLists` (628), `runFinal`'s finally (1584) and `onHide` (1866) — never from Refresh.
- **H2 — CONFIRMED.** Traced the sentinel by hand: `previewTarget = 0` → `needStars = false` →
  `srcStars = null` → `starsKey = "-"` → line 539's first disjunct true against any real cached key
  → `releaseStars()` at 541. Attempted refutation: is this a deliberate memory policy? No — the
  starless set is *not* released under the mirror condition, and the class comment at 509-514 claims
  the caching benefit only in the direction that happens to work. README states it symmetrically.
- **H3 — CONFIRMED, with its precondition stated.** The assignment order is unambiguous in both
  branches. What I could not do from outside PixInsight is prove that `fxPixelMathNew` or
  `IntegerResample.executeOn` throws in practice; the finding therefore rests on "if `makeChannel`
  throws", not on a demonstrated throw. Both are documented to throw on allocation failure, and
  Detail 1:1 on a large frame is the configuration the tooltip itself warns "uses a lot of memory",
  so I judge the path reachable. The unbounded part is confirmed independently: `starlessKey` is not
  updated on the failing path, so the retry re-enters, and `fxUniqueViewId` (`FXProcessing.js:49-55`)
  allocates a fresh identifier each time rather than colliding.
- **H4 — CONFIRMED.** Read directly: `grep -n 'note = \|note +='` returns `+=` at 345, 349 and 359,
  and a bare `=` at 352. Attempted refutation: is the overwrite deliberate — is the multiscale note
  meant to be exclusive? No: line 359 appends *after* it, so the exclusivity would be one-sided and
  arbitrary, and the two warnings it deletes are the ones the README makes load-bearing promises
  about. It is a typo.
- **M1 — CONFIRMED, and deliberately not escalated.** The mechanism is certain: max over a 64-sample
  block of background noise sits well above the mean, and `histogramOf: "stars"` captures the pooled
  image. I considered Critical and rejected it — the pooling is required by the 2.3.5 invariant, the
  displayed image and the histogram agree with each other, the star levels default to identity, and
  the divergence only bites a user who actively sets a star black point. I also checked whether the
  same argument condemns the *starless* histogram: averaging shrinks the distribution's variance
  rather than shifting its centre, so the effect is a narrower histogram rather than a displaced
  one — real but far milder, and I folded it into the same finding rather than raising a second.
- **M2 — CONFIRMED.** Verified all three paint handlers. `FXPreview.js` constructs inside the `try`
  and guards `g.end()`; `FXHistogram.js` and `FXSplitter.js` do neither. Not a speculative hazard —
  the mitigating pattern already exists in the same codebase with a comment explaining it.
- **M3 — CONFIRMED.** `onMousePress` → `applyDrag( x )` → `notify( false )`, unconditionally, for
  any press within tolerance. Checked whether the debounce saves it: it does not — `onValueChanged`
  writes `FX[k.low/mid/high]` synchronously (`FXDialog.js:1326-1328`) regardless of the `finished`
  flag, so the value is committed even if no render follows.
- **L1 — CORRECTED, downgraded from Medium.** My first reading was that the midtones becomes
  permanently unreachable once it sits on the black point, which would have been Medium. The probe
  refuted it: at `mid = 0.001` the markers are 0.578 px apart, and a click anywhere to the right of
  the pair returns the midtones (`d_mid = 4.4 < d_low = 5.0` for a click 5 px right). The finding
  that survives is narrower — the code contradicts its own comment, and the wrong marker is returned
  for clicks on or beyond the far side of a coincident pair. Downgraded to Low and rewritten.
- **L2 — CONFIRMED and quantified by the probe.** Fit 0.0940; wheel out while fitted returns
  `false` and Fit survives, exactly as the comment at 183-186 intends; one notch in then repeated
  notches out gives `0.1000` and then `false` forever. Refutation attempt: is it recoverable?
  Yes — double click returns to Fit and that is documented and works, which is why this is Low and
  not Medium.
- **L3 — CONFIRMED by the probe.** Three representative frames, all showing the render displayed
  1:1 at a readout of 100 % and Fit between 56 % and 75 %. Considered whether "200 %" might mean
  "200 % of Fit": under that reading it would be 112–150 % of the readout and still past the
  pixel-exact point, because `Math.ceil` always makes the render less than 2× the panel. Wrong under
  either reading.
- **L4 — CONFIRMED.** `(k < nc) ? k : (nc - 1)` with `nc == 1` collapses all three channels; the
  paint order 0, 1, 2 leaves blue on top.
- **L5 — CONFIRMED.** The `Math.round` boundary case is arithmetic (`w*h = 180000 → step 1`). The
  sparse-tail argument follows from the stride, not from measurement, and is stated as reasoning
  rather than as a measured result.
- **L6 — CONFIRMED.** Compared the two failure branches directly: 264-268 clears both, 302-305
  clears one.
- **L7 — CONFIRMED as a hardening gap, deliberately kept at Low.** I could not demonstrate that
  `IntegerResample.prototype.Maximum` is ever undefined, and the typed-parameter argument says the
  read-back is almost certainly sound as written. It stays because the guard's stated purpose is to
  survive an API the codebase admits it cannot confirm.
- **L8 — CONFIRMED.** Read `main()` at `ForaxxPaletteStudio.js:371-375`: `fxSaveSettings()` is
  unconditional and `didRun` is used only to choose a console message. The README statement is
  simply wrong, and the splitter persistence claim it sits next to is right *because* it is wrong.
- **N1–N5 — CONFIRMED** by direct reading; all cosmetic or defensive.

### Candidates that did not survive, and are therefore not findings above

- **Zoom anchor drift — REFUTED.** I expected `Math.round` on the scroll position at
  `FXPreview.js:212-213` to accumulate over repeated notches. The probe shows the maximum screen
  drift of the anchored pixel over twelve consecutive `×1.25` notches is **0.500 px and does not
  grow**, because the anchor is recomputed from the current state on each notch rather than carried
  forward. Sub-pixel and bounded. Not a finding.
- **Panel-space / image-space conversion error — REFUTED.** `originAtZoom` (`124-129`) and
  `onPaint`'s `dx`/`dy` (`344-345`) are the identical expression
  `floor( max( 0, (W − size.w) / 2 ) )` evaluated on the same viewport dimensions, and the inversion
  at `193-194` is the exact algebraic inverse of the paint mapping `screen = origin + image·z − scroll`.
  The transformation order at `351-352` (`scale` then `translate`) means the translation is applied
  in scaled coordinates, which is why the offset is divided by `z` — correct, and the comment says
  so. There is no off-by-one.
- **Cache key collision — REFUTED.** `[ factor, sii, ha, oiii ].join( "|" )` cannot be made
  ambiguous: PixInsight view identifiers match `^[A-Za-z_][A-Za-z0-9_]*$` (the same pattern
  `fxSanitize` enforces on `baseId`) and so can never contain `"|"`. A missing channel contributes
  an empty field, which is distinguishable. The `needsSii` state is already folded in, because
  `fxCollectIds` returns `sii: null` when the palette does not need it.
- **`log(0)`, empty bins and single-value images — REFUTED.** `FXHistogram.js:416` guards with
  `(v <= 0) ? 0 : …`, so the logarithm is never taken of zero; `peak` is seeded at 1 (`77`) so the
  divisor is never zero even when every interior bin is empty; and `f` is clamped to 1 at `418` so
  an extreme bin exceeding the interior peak cannot overflow the plot. The probe confirms the one
  degenerate consequence — an image whose mass is entirely in bins 0 and 255 leaves `peak` at its
  seed, and every non-empty interior bin then renders at full height — but that requires a pure
  black-and-white image and is cosmetic. Recorded as part of N-class observations, not raised.
- **Marker ordering (black point above white point) — REFUTED.** `applyDrag` maintains
  `low < high` from both sides: case 0 clamps `low` to `high − 0.002`, case 2 clamps `high` to
  `low + 0.002`, and the subsequent `[0,1]` clamps cannot invert them because `fxSanitize`
  (`FXParameters.js:616-629`) already guarantees `high > low + 0.001` on every restore path. The
  midtones is confined to `[0.001, 0.999]` of the span at `284`. I could not construct an inversion
  from the UI or from a hostile settings file.
- **Marker clipping at the panel edge — REFUTED.** `padding()` is 11 physical px; the widest
  half-width `paintMarker` can draw is `round( 12 × 0.62 ) = 8`. A marker at value 0 spans
  `11 − 8 = 3` to `11 + 9`, and at value 1 spans `w − 19` to `w − 2`. Both are inside the control.
  The comment at `171-173` is accurate.
- **Handlers firing during construction — REFUTED for all three controls.** In `FXLevelsControl`
  every field (`histogram = null`, `low`, `mid`, `high`) is assigned before `setScaledMinSize`
  (`149`) can provoke a resize, and `onPaint` guards on `hist != null` (`387`). `FXPreviewControl`
  calls `initScrollBars()` as its last statement (`364`), and with `displayImage` null it takes the
  zero branch (`141-146`) safely. `FXSplitter` sets its fixed size (`45-49`) before any handler is
  attached, so a paint in that window falls through to the default. `notify` /
  `notifyZoom` both check `instanceof Function` before calling.
- **Temporary image leak at dialog close — REFUTED.** `onHide` (`FXDialog.js:1862-1868`) calls
  `preview.setImage( null )` (which frees the detached `Image`), `engine.release()` and
  `fxSweepTemporaries()`; `main()` sweeps again after `execute()` returns and once more at startup.
  `fxRenderParts` and `fxRenderFinish` each wrap their body in a `try` that calls `fxCloseCreated`
  on the way out, and `fxCloseCreated` frees the detached `histogramImage` as well as closing the
  views. `render`'s own ownership hand-off at `629-630` (`histogramSource` taken, the field nulled)
  is correct on both the success and failure paths, and the dialog frees it in a `finally`
  (`FXDialog.js:314-322`). The README claim holds. H3 is a leak *during* a session, not at close.
- **Zoom re-running the pipeline — REFUTED.** `zoomAbout`, `setZoom`, `zoomAboutCentre` and the
  wheel and double-click handlers touch only `displayZoom`, `fitToPanel` and `scrollPosition`, then
  call `viewport.update()`. `cachedBitmap` is invalidated only by `setImage` (`73`). The only path
  that re-renders on a size change is the dialog's `viewport.onResize`, and only when
  `FX.previewDetail == 0` — which is correct, since Auto's sampling is derived from the panel size.
  README's claim is exact.
- **`starPeaksPreserved` reported stale — REFUTED.** It survives `releaseStars()`, but the status
  line reads it only when `FX.previewTarget == 1` (`FXDialog.js:356`), and reaching that state
  always runs `ensureChannels` with `needStars` true first, which rebuilds the set and rewrites the
  flag (`FXPreview.js:549`). It can never be read stale.
