# 04 — Dialog and UX (`pjsr/lib/FXDialog.js`)

Audit date: 2026-08-28. Scope: 1886 lines, read in full. Cross-read `FXParameters.js`,
`FXPreview.js`, `FXHistogram.js`, `FXSplitter.js`, `FXProcessing.js` (`fxValidate`,
`fxRenderParts`, `fxRenderFinish`, `fxChannelStats`) and `ForaxxPaletteStudio.js` as
references only. Nothing was executed against PixInsight — the file cannot run headless.
The only thing run was `node --check` on the already-generated
`tests/build/check-FXDialog.js`, which parses clean; no repo file was created or modified
other than this report.

## Executive summary

1. **The control surface is, on the whole, accurate.** All 21 numeric rows write exactly
   the parameter their label names — no handler writes a different key — and because
   `fxNumericRow` takes its range and precision straight from `FXRanges[name]`, a slider
   whose range disagrees with the parameter store is structurally impossible. No placebo
   control was found: every parameter the dialog writes is read by `FXProcessing.js` or
   `FXExpressions.js`, with the single benign exception of `twoChannels`, which drives the
   palette list rather than the pipeline.
2. **The 3.0.1 grey-out invariant holds in every state I could construct.** `blendRow
   .enabled = style.dynamic`, `hardHORow` the same, `hardORow = style.dynamic &&
   style.needsSii` (`FXDialog.js:1803-1805`), keyed on the *style's* `needsSii` rather
   than on `FX.twoChannels`, which is the correct discriminator: it also greys the Sii/Ha
   transition for `Foraxx HOO` selected while in 3-channel mode. Every path that can move
   the style (`styleCombo`, the two radios, `Reset all`, `pullFromParameters` →
   `rebuildStyleCombo`) is followed by `updateControls()`, and `fxSanitize` pins
   `blend = 0` on a fixed palette, so a greyed slider genuinely cannot hide a live value.
3. **One clobbered assignment silently deletes the linear-data warning.** At
   `FXDialog.js:352` the multiscale note uses `note =` where the three neighbouring notes
   use `note +=`. Turn on HDR multiscale layers or local contrast and the CAPITALS "THESE
   CHANNELS LOOK LINEAR" warning — the single guard rail on the one input type 3.0.0
   declares unsupported — and the "levels also in force on:" warning both disappear (H1).
   The brief's other hypothesis is refuted: "Rendering preview..." does *not* survive to
   hide the warning, because `applyZoom()` → `updatePreviewStatus()` overwrites it at the
   end of every successful render.
4. **Three status-line notices are erased by the auto-preview they themselves start**
   (H2), including the only notice that changing a source image just wiped all three
   levels sets — behaviour the README and the 2.7.0 changelog both advertise — and the
   post-Execute list of created image names.
5. **Nothing but Execute, Refresh and Close is disabled during a full-resolution run**
   (C1). The file states twice, in its own comments, that PixInsight pumps the event loop
   from inside a running process — that is why `cancelButton` is disabled at line 1557 —
   yet ~40 other controls stay live, and `fxRenderParts`/`fxRenderFinish` read `FX`
   incrementally across the whole pipeline. Moving a slider, switching palette or
   re-selecting a source image mid-run splices two parameter sets into one image, and
   `fxReport` then prints the final state as though it had been used throughout.
6. **Tooltip coverage is not the "tooltips on every control" the README claims** (M1): the
   six `ViewList`s that select the images — the primary input of the whole script — their
   six labels, and the preview panel itself (which carries the wheel-zoom, drag-pan and
   double-click-to-Fit gestures) have none.
7. **Layout, splitters, persistence and the per-image levels machinery are sound.**
   Sections collapse from their `SectionBar`s; both splitters drag, double-click-reset and
   persist; `setPreviewTarget` is a genuine single funnel that moves the value, the combo
   and the levels panel together; `syncing` guards every programmatically-set control
   except, notably, the six ViewLists (L3).

Counts: Critical 1, High 2, Medium 7, Low 8, Nit 5.

---

## Findings

### Critical

#### C1. Every control except Execute, Refresh and Close stays live during a full-resolution Execute, and the pipeline reads `FX` incrementally

- **Location:** `pjsr/lib/FXDialog.js:1538-1615` (`runFinal`), esp. 1552-1557 and 1587-1589;
  consequence in `pjsr/lib/FXProcessing.js:1185-1352` (`fxRenderParts`, `fxRenderFinish`).
- **Evidence:** `runFinal` disables exactly three widgets:

  ```js
  this.executeButton.enabled = false;
  this.refreshButton.enabled = false;
  // PixInsight pumps the event loop from inside a running process, so Close
  // has to go too: dismissing the dialog mid-render would fire onHide and
  // release the engine while fxRenderFinal is still on the stack.
  this.cancelButton.enabled = false;
  ```

  The premise of that comment — that GUI events *are* delivered while a process runs — is
  the file's own, asserted again at line 219 for the preview timer. Everything else stays
  enabled: all 21 sliders, all four section check boxes, the palette combo, the six
  ViewLists, `Reset all`, the histogram markers, the preview-target combo. Their handlers
  write `FX` **immediately and unconditionally** — only the *preview* is debounced.
  Meanwhile `fxRenderParts` reads `p` (= `FX`) at a dozen points spread across the run:
  `fxBuildExpressions(p,…)` first, then `p.hdrEnabled`, `p.curveStrength`, `p.satStrength`,
  `p.extraSaturation`, `fxApplyColourSuppression(v, p,…)`, `p.makeLuminance`, `p.lumApply`,
  `p.localContrast`, `p.posterLevels`, then the star chain, then `fxApplyLevels(…, p, …)`
  and `fxApplyStarLevels(…, p, …)` in `fxRenderFinish`.
  Three concrete paths:
  - a slider nudge while waiting → `FX.satStrength` changes between `fxApplyCurves1` and
    `fxApplySaturation`;
  - re-selecting a source image → `sourceChanged()` (line 589) fires `fxResetAllLevels()`,
    so the starless image is levelled with the user's markers and the stars image with an
    identity (or vice versa) inside a single run;
  - `Reset all` (line 1511) rewrites *every* key, including `styleIndex` and `baseId`,
    mid-render.
  Only `reloadViewLists` (line 622) guards itself with `if ( this.rendering ) return;`.
- **Why it matters:** the image the user gets is not the image any single configuration
  describes, nothing on screen says so, and the console report written afterwards
  (`fxReport`, `ForaxxPaletteStudio.js:337`) prints the *final* `FX` state — so the log
  positively misreports what produced the file. This is the definition of a silently wrong
  image, and it defeats the repo's "one pipeline" invariant from the other direction: the
  parameters, not the code path, diverge.
- **Adversarial check:** the finding stands or falls on whether PixInsight delivers widget
  events during `Process.executeOn`. I cannot test that here. But the code disables `Close`
  for precisely that reason and re-arms the preview timer for precisely that reason, so on
  the codebase's own model it is reachable. If the model is wrong, this degrades to Low —
  and the three deliberate disables become dead code, which is worth knowing either way.
- **Fix:** disable the whole input surface for the duration, not three buttons.
  `this.leftPanel.enabled = false;` plus `this.previewGroup.enabled = false;` and
  `this.levelsGroup.enabled = false;` in the same place, restored in the `finally`, costs
  three lines and covers every present and future control. Belt and braces: snapshot the
  parameters once at the top of `runFinal` (a shallow copy of `FX`) and pass the snapshot
  to `fxRenderFinal`, so even a leaked event cannot reach the running pipeline.

### High

#### H1. `note =` instead of `note +=` deletes the linear-data warning and the off-screen-levels warning

- **Location:** `pjsr/lib/FXDialog.js:338-360`, the offending line is 352.
- **Evidence:**

  ```js
  let note = "";
  let elsewhere = fxLevelsInForceElsewhere( FX.previewTarget );
  if ( elsewhere.length > 0 )
     note += "  -  levels also in force on: " + elsewhere.join( ", " );
  if ( fxLooksLinear( FX ) )
     note += "  -  THESE CHANNELS LOOK LINEAR. Stretch them first; this script needs "
           + "non-linear images.";
  if ( FX.hdrEnabled && (FX.hdrLayers > 0 || FX.localContrast > 0) )
     note = "  -  multiscale stages are approximate at this sampling";   // <-- assignment
  if ( FX.previewTarget == 1 && FX.makeStars && … )
     note += "  -  star peaks are averaged …";
  ```

  Three of the four notes append; the third assigns. Whenever the HDR section is ticked
  *and* `hdrLayers > 0` or `localContrast > 0`, the two notes written above it are thrown
  away. The star-peaks note, written below it, survives.
- **Why it matters:** the linear warning is the one thing this version has left for the one
  input type it declares unsupported. The README promises it in a bordered block ("The
  status line under the preview tells you, in capitals, if the channels you selected look
  linear"), the file header promises it, the 3.0.0 changelog promises it twice, and the
  dialog banner points at it. A user who has turned on HDR multiscale — a plausible thing
  to do while wondering why the image looks wrong — gets a black preview, a note about
  sampling approximation, and no mention of the actual cause. The same line also destroys
  the "levels also in force on: …" warning that 2.7.0 was written to add.
- **Fix:** change line 352 to `note +=`. Consider ordering the notes by severity so the
  capitals land first when several apply.

#### H2. The "source changed — levels reset", "Created …" and "No histogram yet" notices are erased by the preview refresh they themselves trigger

- **Location:** `pjsr/lib/FXDialog.js:589-598` (`sourceChanged`), `1603-1615` (end of
  `runFinal`), `1394` (`levelsAutoButton`); overwritten via `refreshPreview` line 272 and
  `updatePreviewStatus` line 361.
- **Evidence:** `sourceChanged` is the only place the user is told that all three levels
  sets were just wiped:

  ```js
  let cleared = fxResetAllLevels();
  this.syncLevelsToTarget();
  if ( cleared.length > 0 )
     this.previewStatus.text = "Source image changed - levels reset ("
                             + cleared.join( ", " ) + ").";
  this.requestPreview();
  ```

  `requestPreview()` arms the 0.4 s timer; the timer calls `refreshPreview()`, whose first
  visible act is `this.previewStatus.text = "Rendering preview...";` (line 272), and whose
  last is `updatePreviewStatus()` writing the geometry line. The notice is therefore
  visible for ~400 ms, in a status label at the bottom of the preview, while the user's
  eyes are on the image list at the top of the side bar. With `Auto` unticked it survives —
  so the message only works in the configuration nobody uses. `runFinal` has the same
  shape: it writes `"Created Foraxx01, Foraxx01_stars, …  Change palette and run again, or
  Close."` at line 1603 and then calls `this.reloadViewLists()` at line 1615, which calls
  `requestPreview()` and wipes the list of names the user just produced.
- **Why it matters:** silently discarding three levels sets is exactly the class of bug
  2.7.0 was written to fix ("Changing a source image resets every set, **and says which
  ones were carrying something**"). The saying is implemented but not perceivable, so the
  documented behaviour is, in practice, absent — a user who spent ten minutes on a black
  point sees it vanish with no explanation they can still read. The post-Execute case is
  milder (the console keeps the names) but loses the one on-screen record of the run.
- **Fix:** give notices a life of their own. Keep a `this.pendingNotice` string, have
  `updatePreviewStatus()` append it to the geometry line, and clear it on the next user
  action rather than on the next render. Alternatively, for the levels reset specifically,
  put the message where the consequence is — retitle the levels group box, or flash the
  readout — rather than in a shared status line.

### Medium

#### M1. The six image selectors, their labels and the preview panel have no tooltips

- **Location:** `pjsr/lib/FXDialog.js:536-580` (`makeViewRow`), `1089`
  (`this.preview = new FXPreviewControl( this );`); `FXPreviewControl` itself sets no
  `toolTip` anywhere in `FXPreview.js`.
- **Evidence:** `makeViewRow` builds `row.label`, `row.list`, `row.starLabel`,
  `row.starList` and sets `text`, `textAlignment`, `setFixedWidth`,
  `excludeIdentifiersPattern`, `getMainViews()` and `onViewSelected` — and no `toolTip`, on
  any of the four, for any of the three rows. Twelve controls. The preview `ScrollBox` is
  likewise bare; the wheel-zoom, drag-to-pan and double-click-to-Fit gestures are described
  only in `zoomTip`, attached to the four small zoom buttons and the readout. The four
  plain `SectionBar`s (`channelsBar`, `paletteBar`, `starsBar`, `outputBar`) also have
  none, where the four switched ones put a tooltip on their check box.
- **Why it matters:** the README's 2.1.0 entry claims "tooltips on every control", and the
  rest of the file honours that claim scrupulously — `fxNumericRow` attaches the same
  tooltip to five widgets each so that hovering anywhere in the row works. The gap is
  precisely at the controls a first-time user meets first, and the one that hides
  non-obvious gestures. A user with no tooltip on the preview has no way to discover that
  the wheel zooms or that a double click returns to Fit.
- **Fix:** one tooltip string per `makeViewRow` call site (what the channel is, that it
  must be greyscale, same geometry, non-linear, and that the right-hand column is the star
  frame), attached to all four widgets; and `this.preview.toolTip = zoomTip;` after line
  1089 — `zoomTip` is already written and already says everything needed.

#### M2. "levels also in force on: stars / luminance" is reported for images that will never be produced

- **Location:** `pjsr/lib/FXDialog.js:343-345`; `fxLevelsInForceElsewhere` at
  `pjsr/lib/FXParameters.js:388-396`.
- **Evidence:** the helper walks all three of `FX_LEVEL_SETS` unconditionally:

  ```js
  for ( let i = 0; i < FX_LEVEL_SETS.length; ++i )
     if ( i != shownIndex && !fxLevelsAreIdentity( FX_LEVEL_SETS[i] ) )
        names.push( FX_LEVEL_SETS[i].name );
  ```

  It never consults `FX.makeStars` or `FX.makeLuminance`. With *Starless only* ticked, the
  stars image is not built and `starLevelsLow/Mid/High` are read by nothing; with the
  Artificial luminance section off, `fxRenderFinal` passes no `luminance` option and
  `lumLow/Mid/High` are read by nothing. In both cases the status line still says those
  levels are "in force". Both sets are easy to acquire innocently: the Luminance preview
  target works with the section off (deliberately, and documented), so anyone who looks at
  the L layer and drags a marker leaves a non-identity set behind for good.
- **Why it matters:** it is a warning the user cannot act on and that is not true. The
  whole point of the note (2.7.0: "a black point you can't currently see can't silently
  shape what you build") is to name a real hazard; naming a non-hazard in the same words
  trains the user to ignore the real one. The user's only route to clearing it is to switch
  the preview target to that image and press Reset, which is not obvious from the text.
- **Fix:** pass the gating flags in — skip index 1 when `!FX.makeStars` and index 2 when
  `!FX.makeLuminance` (an optional second argument keeps the signature compatible with the
  `fxResetAllLevels` caller). Better still, name the remedy in the note: "levels also in
  force on: stars (switch the preview target there and press Reset)".

#### M3. An empty or invalid output identifier blanks the preview and the histogram

- **Location:** `pjsr/lib/FXDialog.js:1055-1060` (`baseIdEdit.onEditCompleted`) and
  `255-268` (`refreshPreview`); `fxValidate` at `pjsr/lib/FXProcessing.js:1112-1121`.
- **Evidence:** the edit handler does no validation at all —

  ```js
  this.baseIdEdit.onEditCompleted = function()
  {
     FX.baseId = this.text.trim();
     this.text = FX.baseId;
  };
  ```

  — while `refreshPreview` runs the *full* `fxValidate`, which includes the three output
  identifier checks, and on any problem does:

  ```js
  this.previewStatus.text = problems[0];
  this.preview.setImage( null );
  this.levels.setHistogram( null );
  ```

  So clearing the name field, or typing `M42 SHO` with a space, makes the preview image and
  the histogram vanish at the next control change, with the message "The output image name
  is empty." The preview does not depend on `baseId` in any way — the engine renders into
  `FXtmp_out…`.
- **Why it matters:** the brief's requirement that an invalid identifier be *reported, not
  thrown* is met — `fxValidate` reports it and `runFinal` shows it in a `MessageBox`. But
  the coupling is wrong in the other direction: a typing mistake in an output name destroys
  the live preview the user is working against, and the message appears in a status line
  they may not associate with the field they just left. It also blanks the histogram, which
  discards the bins for the image they were levelling.
- **Fix:** split the validation. Have `refreshPreview` filter out the `baseId` problems
  (they cannot affect a preview) and keep rendering; report the name problem next to the
  field — colour the `Edit`, or append it to the status line without tearing the image
  down. `runFinal` should keep the full check exactly as it is.

#### M4. "Reset all" moves a 2-channel user into a 3-channel palette they cannot satisfy

- **Location:** `pjsr/lib/FXDialog.js:1507-1520`.
- **Evidence:** the handler copies every key of `FXDefaults` into `FX`. `FXDefaults` is
  built from the whole of `FX` minus the `*View` keys (`FXParameters.js:396-402`), so it
  includes `styleIndex: 0` and `twoChannels: false`. `fxSyncStyle()` then confirms three
  channels because style 0 (*Foraxx — classic*) has `needsSii: true`. A user working from
  dual-narrowband OSC data on *HOO* who presses Reset all lands on *Foraxx — classic*, in
  3-channel mode, with the Sii row re-enabled and empty, and the preview reporting "No
  image selected for Sii." The button's tooltip is:

  > "Put every slider and checkbox back to its factory default. Your channel selection is
  > kept."

  The tooltip is literally true — the `siiView`/`haView`/… wrappers do survive — but the
  channel *count*, the palette, the output name, the preview target, the zoom, the sidebar
  width and the histogram height all change, and none of those is a slider or a check box.
- **Why it matters:** the state is recoverable (click *2 channels*), but the user has to
  work out what happened from an error about an image they never had. It is also the one
  button whose whole purpose is "get me back to a known state", so surprising behaviour
  there is expensive.
- **Fix:** preserve `twoChannels` across the reset and re-derive the style from it
  (`FX.twoChannels = wasTwo; if ( wasTwo ) fxApplyStyle( fxFirstStyleFor( true ) );`), and
  either preserve `sideBarWidth`/`histogramHeight` or say in the tooltip that the layout
  is reset too.

#### M5. 3.0.1 makes a previously reachable capability unreachable and discards the stored value without a word

- **Location:** `pjsr/lib/FXDialog.js:1803-1805`; `fxSanitize` at
  `pjsr/lib/FXParameters.js:637-639`; README lines 205-219.
- **Evidence:** 2.5.0 shipped, and documented at length, the ability to raise the Foraxx
  amount on a fixed palette:

  > "**Every palette now has both transition sliders.** … Turn the amount up and the
  > transitions come alive on any palette. … That is what makes a fixed palette arrive
  > *exactly* at the Foraxx palette with the same mapping as you raise the amount —
  > verified to zero deviation for both SHO and HOO."

  3.0.1 removes it: `blendRow.enabled = style.dynamic` gives no UI route to a non-zero
  `blend` on SHO/HSO/HOS/OHS/OSH/SOH/HOO/OHH, and `fxSanitize` forces `FX.blend = 0` on
  every load and every process-icon import. A user who saved a settings file or a process
  icon in 3.0.0 with `SHO, blend 0.50` gets `blend 0` on the next launch, with no console
  note, no dialog message, and a greyed slider that cannot show them what changed. That is
  the same class of silent restore-time mutation `fxMigratePaletteBlend` was written to
  announce, handled here without the announcement.
- **Why it matters:** the README's *current* control table is consistent with 3.0.1, but
  the retained 2.5.0 section (inside `<details>`, which many readers open) still describes
  the removed capability as present, and the "verified to zero deviation" claim is now
  about behaviour nobody can invoke. Meanwhile the intermediate blends were, by that same
  section's account, a deliberate feature rather than an accident.
- **Fix:** decide which it is. If the greying is right, annotate the 2.5.0 README section
  (`> Removed in 3.0.1 — see above`) and have `fxSanitize` say so on the console once when
  it actually zeroes a non-zero stored blend. If the capability was worth having, keep the
  sliders enabled and drop 3.0.1's grey-out for `blendRow`/`hardHORow`, leaving only the
  `hardORow`-needs-Sii rule from 2.5.0.

#### M6. Execute and Reload silently do nothing while a preview render is in flight

- **Location:** `pjsr/lib/FXDialog.js:1540` (`runFinal`) and `622` (`reloadViewLists`).
- **Evidence:** both open with `if ( this.rendering ) return;`. `refreshPreview` sets
  `this.rendering = true` at line 270 and calls `processEvents()` at line 274 before
  entering `engine.render`, so clicks land during the render. Only `refreshButton` is
  disabled in that window (line 271); `executeButton` and `reloadButton` stay enabled and
  clickable, and their click is discarded with no message, no beep and no status change.
- **Why it matters:** a 1:1 preview render on a large frame is not quick. Pressing Execute
  and getting nothing reads as a broken button; the user presses it again, and again, and
  each press is dropped. The wait cursor and "Rendering preview..." are some evidence that
  the dialog is busy, but nothing connects them to the discarded click.
- **Fix:** disable both buttons alongside `refreshButton` in `refreshPreview` (and re-enable
  them in the same `finally`), which also makes the guard clauses redundant rather than
  invisible. If they must stay clickable, set `previewStatus.text` to say the click was
  deferred.

#### M7. The README's promise that closing with Close leaves the previous settings alone is false

- **Location:** `ForaxxPaletteStudio.js:390-393` (the authority), interacting with
  `FXDialog.js:1610` (`fxSaveSettings()` inside `runFinal`) and the Close tooltip at 1621.
- **Evidence:** README, *Other notes*:

  > "Only a run you accept with **Execute** becomes the new stored default; closing with
  > **Close** leaves your previous settings alone."

  `main()` does the opposite, deliberately and with a comment saying so:

  ```js
  dialog.execute();
  // Whatever happened in there, the settings the user left behind are the
  // ones they want next time - a session spent tuning and then closed without
  // an Execute must not be thrown away.
  fxSaveSettings();
  ```

  So `fxSaveSettings` runs on *every* exit, and the `fxSaveSettings()` inside `runFinal` is
  merely an early flush.
- **Why it matters:** a user who opens the dialog to try something extreme, sees it is
  wrong and presses Close in the belief that this discards it, reopens to find the extreme
  settings restored. The behaviour in the code is defensible — arguably better — but the
  README states the opposite, and the dialog's Close tooltip ("Anything you already built
  with Execute stays where it is") does not correct it.
- **Fix:** the code is right; fix the README sentence. While there, consider saying it in
  the Close tooltip: "Your settings are kept for next time either way."

### Low

#### L1. The `o`/`ho` factor check box stays enabled on fixed palettes, where those images are not used to build anything

- **Location:** `pjsr/lib/FXDialog.js:1073-1076`; `fxRenderParts` at
  `FXProcessing.js:1225-1233`; `fxBuildExpressions` at `FXExpressions.js:253-266`.
- **Evidence:** the expressions always compute `o` and `ho`, but with `blend = 0` (which
  `fxSanitize` guarantees on a fixed palette) `fxMix(a, b, 0)` returns `b`, so neither mask
  appears in `r`, `g` or `b`. `fxRenderParts` nevertheless writes `base + "_o"` and
  `base + "_ho"` whenever `opts.factors` is set. The check box tooltip calls them "The
  intermediate mask images", which on a fixed palette they are not — nothing intermediate
  used them. Their shape is set by `hardO` and `hardHO`, both greyed out on that palette by
  3.0.1. So the user can produce two images that are governed entirely by two controls they
  cannot reach.
- **Fix:** either `this.factorsCheck.enabled = style.dynamic;` in `updateControls` for
  consistency with the 3.0.1 pass, or soften the tooltip to say the masks are produced for
  reference on a fixed palette and do not contribute to the result.

#### L2. The normalization Reference combo still offers "Sii" on a palette that has no Sii

- **Location:** `pjsr/lib/FXDialog.js:685-692` and `1815-1829`.
- **Evidence:** `updateControls` corrects `FX.normalizeRef` from 0 to 1 *when it runs*, but
  the combo keeps all three items and stays enabled. Selecting "Sii" on HOO writes
  `FX.normalizeRef = 0` and requests a preview; `fxStretchMapFor`
  (`FXProcessing.js:341-343`) quietly substitutes Ha, and the combo is only snapped back at
  the next `updateControls` — which a slider move does not trigger. So the control displays
  a reference that is not being used, for as long as the user stays on sliders.
- **Fix:** disable the Sii item (or the whole row's Sii option) in `updateControls` when
  `!needsSii`, rather than repairing the value after the fact.

#### L3. The six ViewLists are the only programmatically-set controls not guarded by `syncing`, and their handler is the most destructive one in the dialog

- **Location:** `pjsr/lib/FXDialog.js:536-580`, `589-598`, `620-668`.
- **Evidence:** `styleCombo`, `previewTargetCombo`, `normRefRow.combo`, both radios and
  every check box are set under `this.syncing = true` with a matching `if ( dlg.syncing )
  return;` in the handler — a consistent, deliberate pattern. `reloadViewLists` assigns
  `list.currentView = FX[key]` (line 646) with no such guard, and `onViewSelected` →
  `sourceChanged()` → `fxResetAllLevels()`. If PJSR ever emits `onViewSelected` on a
  programmatic assignment, every *Reload image list* and every Execute (which ends by
  calling `reloadViewLists`) would wipe all three levels sets.
- **Adversarial check:** PJSR conventionally does *not* fire handlers on programmatic
  property assignment, and the rest of this file only guards for belt-and-braces. So this
  is very likely latent rather than live — but it is the one place where the file's own
  defensive convention is not applied, and the one place where the cost of being wrong is
  destroying user work.
- **Fix:** wrap the assignment loop in `this.syncing = true` / `finally` and add
  `if ( dlg.syncing ) return;` to the six `onViewSelected` closures, matching every other
  control.

#### L4. The six persisted levels values can never usefully survive into a new session, and announce their own destruction on the first image the user picks

- **Location:** `pjsr/lib/FXDialog.js:589-598`; `FXPersisted` entries in
  `FXParameters.js:494-501`.
- **Evidence:** views are not (and cannot be) persisted, so every new session begins by
  selecting a source image, which calls `sourceChanged()`, which calls `fxResetAllLevels()`
  unconditionally. Any persisted non-identity levels set is therefore wiped before it can
  ever be applied — and, because `cleared` is non-empty, the fresh dialog greets the user's
  very first click with "Source image changed - levels reset (starless)." about markers from
  a previous day.
- **Fix:** stop persisting the six levels values (they are, by design, tuning for one
  particular pair of images — the 2.7.0 rationale says exactly that), or suppress the
  notice when no source had previously been selected.

#### L5. The side bar width persists up to 1400 logical pixels with no check against the screen

- **Location:** `pjsr/lib/FXDialog.js:1437-1449`; clamps repeated in
  `FXParameters.js:594-596`.
- **Evidence:** `setSideBarWidth` clamps to `[400, 1400]` and calls
  `leftPanel.setFixedWidth(…)`; `FXSplitter`'s own comment explains that a *fixed* width is
  deliberate, "a minimum can still be squeezed by a sizer under pressure … whereas a fixed
  size cannot". The dialog's `setScaledMinSize( 980, 640 )` is then not a constraint on the
  side bar at all. A session on a wide monitor that leaves the side bar at 1400, reopened on
  a 1366-wide laptop, produces a dialog wider than the screen with the preview — and the
  splitter that would fix it — pushed off the right edge.
- **Fix:** clamp against `dlg.availableScreenRect.width` (or simply against the dialog's own
  width) in `setSideBarWidth`, so a stored value can never exceed what fits.

#### L6. `updatePreviewStatus` — a pure display path — can run nine full-resolution statistical passes

- **Location:** `pjsr/lib/FXDialog.js:348` (`fxLooksLinear( FX )`), reached from
  `applyZoom` (1113), `onZoomChanged` (1122-1127) and `viewport.onResize` (1092-1104);
  `fxChannelStats` at `FXProcessing.js:157-205`.
- **Evidence:** `fxChannelStats` runs `image.median()`, `image.MAD()` and `image.minimum()`
  — three full passes — per view, and `fxLooksLinear` visits all three nebula channels. It
  is cached, but `fxClearStatsCache()` is called by *Refresh* (line 1254) and by `runFinal`
  (line 1571) and `reloadViewLists` (line 628). With Channel normalization off — the default
  — nothing in the pipeline populates that cache, so `fxLooksLinear` is its only filler. A
  mouse-wheel notch over the preview in the window between a cache clear and the next
  completed render therefore blocks on nine passes over full-size frames, from a path whose
  own tooltip says it "repaints the image already in hand and never runs the pipeline again".
- **Fix:** cache the linear verdict alongside the render (compute it once in
  `refreshPreview`, store it on `this`, and have `updatePreviewStatus` read the stored flag),
  so the display path never measures anything.

#### L7. A disabled Stars section cannot be collapsed, so it keeps its vertical space

- **Location:** `pjsr/lib/FXDialog.js:1809-1810`.
- **Evidence:** `this.starsBar.enabled = stars;` — the comment explains, correctly, that the
  bar must grey with its contents. But a disabled `SectionBar` does not accept clicks, so the
  collapse arrow is inert: a user working starless-only cannot fold away the three greyed
  controls and the four-line explanatory note, which is the section that most wants folding.
- **Fix:** collapse the section (`this.starsControl.hide()`) when it is disabled, as the
  switched sections already do for their own check boxes, and restore it when stars come
  back.

#### L8. With `Auto` off there is no indication that the preview is stale

- **Location:** `pjsr/lib/FXDialog.js:1237-1246` (`autoPreviewCheck`), `232-238`
  (`requestPreview`).
- **Evidence:** `requestPreview` returns immediately when `!FX.autoPreview`. The status line
  keeps showing the geometry, zoom and notes of the *previous* render, which is now
  describing an image built with different parameters. Nothing marks the image as out of
  date, and the tooltip only says to "use Refresh instead".
- **Fix:** in `requestPreview`, when auto is off, append " - out of date, press Refresh" to
  the status line (or dim the preview), and clear it on the next successful render.

### Nit

#### N1. `fxResetButton`'s tooltip argument is dead

`pjsr/lib/FXDialog.js:62-69` and `117-122`: `fxResetButton( …, "Reset " + labelText + " to its
default.", … )` sets `btn.toolTip`, and the very next statement overwrites it with
`"Reset to the palette's starting value.<br/>" + toolTipText`. The parameter is only ever
passed a value that is discarded. Drop the parameter or drop the second assignment.

#### N2. The generic row tooltip promises a "palette starting value" for eleven rows no palette defines

`pjsr/lib/FXDialog.js:103-107`: every row's tooltip ends "The button on the left puts it back
to the palette's own starting value." `defaultOf()` (lines 79-84) falls back to
`FXDefaults[name]` for `normSii`, `normHa`, `normOiii`, `normShadow`, `starStretch`,
`starSaturation`, `hdrAmount`, `hdrKnee`, `hdrLayers`, `localContrast` and `lumApply` —
eleven of twenty-one rows — because no entry in `FXStyles` mentions them. Correct behaviour,
slightly wrong words.

#### N3. The palette combo is filled twice at construction

`pjsr/lib/FXDialog.js:442-443` adds all `FXStyles` items, then `rebuildStyleCombo()` (reached
from `pullFromParameters()` at the end of the constructor) calls `clear()` and re-adds the
filtered set, because `styleComboTwoChannels` starts as `null` and never equals a boolean.
Harmless, but the first loop is unreachable state.

#### N4. `Posterise levels = 1` is silently a no-op

`FXRanges.posterLevels` is `[0, 16, 0]`, so the slider stops at 1 on the way up.
`fxApplyPosterise` returns early for `levels < 2` (`FXProcessing.js:680`) and `fxSanitize`
rewrites a stored 1 to 2 — but nothing corrects a 1 typed or dragged during the session. The
tooltip says "0 is off". Either say "0 and 1 are off" or snap 1 to 2 in the row's handler,
which already rounds.

#### N5. One control, three names

The check box reads "Starless only - do not build a stars image" (`FXDialog.js:418`); the
preview's own error message tells the user to untick `"Starless images only"`
(`FXPreview.js:581-582`); the README says *Starless images only* in two places. The error
message quotes a label that does not exist on screen. Make the three agree.

---

## Verification

Each finding was re-derived from the code after the first pass, with an explicit attempt to
refute it.

- **C1 — CONFIRMED, with a stated dependency.** Refutation attempted three ways. (a) *Does
  a guard elsewhere catch it?* `runFinal` guards only re-entry into itself and
  `reloadViewLists`; the timer guard at 218-223 protects the preview, not `FX`. (b) *Does
  the pipeline snapshot its parameters?* No — `fxRenderParts`/`fxRenderFinish` take `p` by
  reference and read ~15 distinct fields at successive stages. (c) *Are events actually
  delivered?* Not verifiable here; the file asserts it twice and disables `Close` on that
  basis. Severity kept at Critical because the outcome is an image no configuration
  describes plus a console report that misstates it; downgrade path stated in the finding.
- **H1 — CONFIRMED.** Read four times. Line 352 is `note =`; 345, 349 and 359 are `note +=`.
  No later line restores the discarded text — the next statement is the `format(…) + note`
  assignment. The related claim in the brief, that "Rendering preview..." hides the warning,
  is **REFUTED**: `refreshPreview` → `applyZoom` → `updatePreviewStatus` overwrites it on
  every successful render, and on a failed render the status is the engine's error, which is
  what should be shown.
- **H2 — CONFIRMED.** Traced the timer: `requestPreview` → 0.4 s → `refreshPreview` → line
  272 overwrite. **CORRECTED** in one respect during verification: with `Auto` unticked
  `requestPreview` returns at line 234 and the notice persists, so the defect is
  configuration-dependent — but the affected configuration is the default. Also confirmed the
  same shape at `runFinal` line 1603 followed by `reloadViewLists` at 1615.
- **M1 — CONFIRMED.** Enumerated every `new Label/ComboBox/ViewList/PushButton/…` in the file
  against every `toolTip` assignment. Twelve widgets in `makeViewRow`, the preview control,
  and four plain `SectionBar`s carry none. `FXPreview.js` and `FXHistogram.js` contain no
  `toolTip` assignment at all, so the preview panel is not covered from the other side.
- **M2 — CONFIRMED.** `fxLevelsInForceElsewhere` takes only `shownIndex`; no caller filters
  its result; `updatePreviewStatus` prints it verbatim. Checked that the luminance set is
  genuinely reachable with the section off — `previewTargetCombo` allows target 2
  unconditionally and `FXPreview.js:616-617` renders it via `opts.luminance`, which is exactly
  what the README advertises.
- **M3 — CONFIRMED.** `fxValidate` is called whole from `refreshPreview:260`; its identifier
  branch at `FXProcessing.js:1112-1121` fires on an empty or malformed `baseId`; the handler
  at 261-267 blanks image and histogram. **CORRECTED** from my first reading: this is *not* a
  missing-validation defect — the brief's requirement (report, don't throw) is met in both the
  preview and `runFinal`. The finding is the coupling, and is downgraded accordingly.
- **M4 — CONFIRMED.** Verified `FXDefaults` includes `styleIndex` and `twoChannels` (the IIFE
  at `FXParameters.js:396-402` excludes only keys containing "View"), and that
  `fxSyncStyle()` cannot restore two-channel mode because style 0 needs Sii. Verified the
  views themselves *do* survive, so the tooltip is not false, only incomplete — severity held
  at Medium rather than raised.
- **M5 — CONFIRMED.** Searched for any surviving route to a non-zero `blend` on a fixed
  palette: none. `fxSanitize:637-639` zeroes it on both restore paths, and no console line
  is emitted when it does (unlike `fxMigratePaletteBlend`, which at least has a comment
  explaining itself). README lines 205-219 verified verbatim.
- **M6 — CONFIRMED.** `runFinal:1540` and `reloadViewLists:622` both return silently;
  `refreshPreview:271` disables only `refreshButton`; `processEvents()` at 274 opens the
  window for the click.
- **M7 — CONFIRMED.** `ForaxxPaletteStudio.js:390` calls `fxSaveSettings()` unconditionally
  after `dialog.execute()`. README line 656-658 says the opposite. Noted that the defect is
  in the README, not the dialog; the dialog's own Close tooltip makes no false claim.
- **L1 — CONFIRMED.** `fxRenderParts:1227` gates on `opts.factors` alone; `fxBuildExpressions`
  returns non-null `o`/`ho` regardless of `blend`; the architecture doc's own rule
  (`fxMix(a, b, 0)` returns `b`) proves the masks are absent from the output expressions on a
  fixed palette.
- **L2 — CONFIRMED.** The correction at 1815-1829 runs only inside `updateControls`, which no
  slider or combo handler calls; `FXProcessing.js:341-343` shows the engine ignoring the
  displayed choice.
- **L3 — CONFIRMED as an inconsistency, DOWNGRADED as a live bug.** I could not establish that
  PJSR emits `onViewSelected` on assignment, and the convention is that it does not; kept at
  Low and labelled as defence-in-depth, not as an observed failure.
- **L4 — CONFIRMED.** `sourceChanged` has no first-run special case; the six levels keys are
  in `FXPersisted`; views are not persistable.
- **L5 — CONFIRMED.** `setSideBarWidth` clamps only to `[400, 1400]`; nothing consults screen
  geometry; the fixed width is documented as intentionally un-squeezable.
- **L6 — CONFIRMED but DOWNGRADED.** My first note claimed a cost on every wheel notch; on
  re-checking, `updatePreviewStatus` runs at the end of every successful render and so
  normally repopulates the cache before the user can zoom. The exposure is limited to the
  window between a `fxClearStatsCache()` and the next completed render. Low.
- **L7 — CONFIRMED by inspection of the enable logic**; rests on the standard Qt rule that a
  disabled widget takes no mouse input. If `SectionBar` handles its arrow differently this
  becomes moot, hence Low.
- **L8 — CONFIRMED.** `requestPreview:232-238` returns before touching the status line.
- **N1–N5 — CONFIRMED**, all by direct re-reading of the cited lines.
- **Explicitly REFUTED during verification** (raised on the first pass, dropped):
  - *"A handler writes a parameter other than the one its label names."* All 21 numeric rows
    checked one by one against `FX` — every one matches, including the two that round
    (`posterLevels`, `hdrLayers`).
  - *"A slider's range or precision disagrees with FXRanges."* Impossible by construction:
    `fxNumericRow` reads `FXRanges[name]` for `setRange`, `setPrecision` and `setReal`, and
    every one of the 21 names has an entry. The uniform `slider.setRange(0, 1000)` is a widget
    resolution, not a value range.
  - *"Some control is a placebo."* Every parameter the dialog writes was traced to a reader in
    `FXProcessing.js` or `FXExpressions.js`. `twoChannels` alone has no pipeline reader, and
    correctly so — it selects the palette list.
  - *"The 3.0.1 grey-out logic misses a state."* Enumerated all 15 styles × {2-channel,
    3-channel} × {stars, starless} against lines 1803-1805. `style.dynamic` and
    `style.needsSii` are the right keys — using `FX.twoChannels` instead would have wrongly
    enabled the Sii/Ha transition for *Foraxx HOO* in 3-channel mode. Every mutation path
    calls `updateControls()`. The invariant holds.
  - *"Handlers fire during construction."* `fxCheckBox`, `fxComboRow` and `fxNumericRow` all
    set the value *before* attaching the handler; `pullFromParameters` wraps everything in
    `syncing`; `viewport.onResize` firing during `adjustToContents()` is absorbed by
    `initialised === false`.
  - *"The preview debounce is broken."* 0.4 s, non-periodic, restarted by `requestPreview`,
    and re-armed rather than re-entered when a render is in flight. Correct, and matches the
    README's "about half a second".
  - *"Execute closes the dialog"* / *"per-slider resets are missing"* / *"splitter sizes are
    not remembered"* / *"Sii palettes are visible in 2-channel mode"* / *"switching the preview
    target does not restore that image's markers"* / *"New Instance does not export" —* all
    checked, all present and correct. Note one **CORRECTION** to the brief's wording: the
    per-slider reset buttons restore *the current palette's* starting value, falling back to
    `FXDefaults` only for the eleven parameters no style defines. That is deliberate, is
    explained in a comment at lines 79-82, and is what the button's tooltip says.
