# Changelog

All notable changes to Foraxx Palette Studio.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries up to 3.0.1 were reconstructed from the version history block in
`ForaxxPaletteStudio.js`, which remains the authoritative record for those
releases.

## [Unreleased]

## [3.1.2] - 2026-08-28

Two faults in the star field, the first hiding the second. **The stars image
changes**; the starless image at the defaults does not, and the parity gate
against 3.1.0 reads 0.

**Validation.** Node harness green: 3935 assertions across nine suites, with the
new rules pinned and verified by mutation. Both faults were measured on the
reference masters before and after, headless, in the configuration that
reported them - HOO, two channels, Ha and Oiii only. The variants were then
compared on screen before the curve was chosen.

### Fixed
- **Stars no longer come out blue on the HOO palettes.** The star combination
  was given the palette's `needsSii`, which describes what the *nebula* mapping
  requires, so an HOO palette discarded the Sii star frame even when one was
  selected and the channel count was three. Red fell from `0.5·Ha + 0.5·Sii` to
  `Ha` alone while green and blue kept their Oiii, and the star field turned
  blue.

  Stars are broadband sources: the palette decides how the nebula is coloured,
  not how much data the star mix is allowed. Only the channel count removes the
  Sii now.
- **And the blue cast itself is gone.** With only Ha and Oiii there is no Sii to
  restore, and the field was still blue: the star frames were conditioned with
  the nebula's curve *per channel*, so Oiii - lifted hard to match Ha in the
  nebula - carried that lift into the star mix while red, being Ha alone, kept
  none of it. Measured on the reference masters: mean R/G/B 0.0144 / 0.0215 /
  0.0245, blue 70% above red.

  All three star channels now share one curve, the Ha one, and each keeps its
  own black point. Same masters: 0.0144 / 0.0118 / 0.0107, the mild warmth a
  real stellar population has. Ha rather than the reference channel so the star
  colour does not move when the Reference combo does.

  **This changes the stars image wherever normalization or linear input is on.**
  The starless image is untouched.

## [3.1.1] - 2026-08-28

**Minimum PixInsight is now 1.9.0.** The script runs on the V8 JavaScript
engine, which 1.8.9 does not provide. Nothing about the images changes: the
expressions, the defaults and the pipeline are untouched, and the harness pins
them as before.

**Validation.** Node harness green: 3923 assertions across nine suites. The
whole pipeline was driven headless against the six reference masters
(`PixInsight -n --automation-mode -r=probe.js --force-exit`): the dialog builds,
the engine renders 1254x700, no error. The interface was then exercised by hand.

### Fixed
- **The script runs on PixInsight builds without SpiderMonkey.** The macOS arm64
  build of 1.9.4 ships none, and the script died on launch with "The legacy 'sm'
  JavaScript engine is not available in this PixInsight build." It now declares
  `#engine v8`, which raises the minimum to PixInsight 1.9.0.

  Two changes follow from the engine, both measured against a headless probe
  rather than assumed. `Sizer.jsh`, `NumericControl.jsh` and `SectionBar.jsh`
  are no longer included: V8 provides those classes as built-in globals and
  refuses the headers' redeclaration of them. And `ForaxxStudioDialog`,
  `FXPreviewControl` and `FXLevelsControl` are ES classes with `super()`, since
  the old `this.__base__ = Dialog; this.__base__();` pattern calls a class
  constructor as a function.

  Three more followed, each found the same way. The process enumerators are
  static on the constructor under V8, not on the prototype - `PixelMath.RGB`,
  not `PixelMath.prototype.RGB`, which is `undefined` and fails as "signed
  integer value expected". That one let the dialog open perfectly and the
  preview render nothing. `processEvents()` is deprecated and warns on every
  call. And a thrown value is not always an `Error`, so reading `.message` off
  it reported the failure above as "Preview failed: undefined" and took its own
  cause with it.

## [3.1.0] - 2026-08-28

No change reaches the starless image at the default settings. The **stars**
image does change, and deliberately - see Removed.

**Validation.** Node harness green: 3923 assertions across nine suites,
including the expressions for *Foraxx - classic* at defaults, which are pinned
literally against Paul Hancock's original. Linear input measured on the
reference linear masters: 0.250 on all three channels, combined background
0.2502, against the 0.4375 the 2.6.1 fault produced. The dialog, the preview in
both languages, and the linear and HDR paths were exercised by hand in
PixInsight through the session that produced this release.

**Not done.** The pixel parity gate in `docs/RELEASING.md` step 2 has not been
run: it compares a build against the previous tag's output on the reference
master set, and this is the first tag under Caelo Works, so there is nothing to
compare against. The pinned expression tests stand in for it here, and the gate
becomes runnable from the next release onward. The full palette walk and the
settings/process-icon migration check from that step were likewise not carried
out formally.

### Changed
- Project taken over by Caelo Works for long-term maintenance and distribution,
  with the agreement of Nicolas Godingen, who wrote it.
- Licensed CC BY-NC 4.0, inherited from upstream work rather than chosen; see
  `LICENSE` and `NOTICE.md`, which ships inside the distribution package.
- The menu entry moves from **Script → Utilities** to **Script → CaeloWorks**,
  and gains an icon.
- The release tag is now the version. The entry script carries `__BUILD__`,
  stamped at packaging time, so the zip name and the dialog label cannot
  disagree.
- Three console warnings announced themselves as "Auto stretch", a stage removed
  in 3.0.0. They are named for what emits them — channel normalization — and one
  of them no longer sends the user after two controls that no longer exist.
- **The settings column scrolls** instead of the window resizing itself to fit
  it. Collapsing a section no longer changes the window size either. The two
  draggable dividers were removed along the way: they sat beside the new scroll
  bar and were routinely dragged in mistake for it.
- **The interface is available in French**, chosen from the header. Image
  identifiers and console output stay in English: they are what you type and
  what you paste into a forum post.
- **The star treatment is the broadband combination and the brightness stretch,
  and nothing else.** See Removed.
- The console report for the HDR stage prints what ran rather than what was
  asked for, including the multiscale layer count after the frame-size cap, and
  says so when the two differ.
- `styleNote` no longer claims that choosing a palette sets every tuning slider;
  it sets fourteen values and leaves normalization, linear input, stars, HDR and
  luminance alone. `normalizeBarTip` describes the target the code actually
  aims at - the reference median times that channel's own level, or an absolute
  target on linear input.
- The *Foraxx - with colour clean-up* entry no longer labels itself
  "(recommended)" while the factory default is *classic*.

### Added
- A node test harness: nine suites, covering the PixelMath
  expressions, numeric emission, the conditioning arithmetic, the parameter
  surface, output naming, the settings/process-icon defensive layer, the string
  tables in both languages, the process wrappers, and a scan for identifiers and
  event-handler names nothing declares.
- A full technical audit of the inherited code, seven reports each with its own
  adversarial verification pass, and a consolidated backlog. Kept out of the
  repository; its findings arrive here as commits.
- CI on every push: the harness on two Node versions, shellcheck, a package
  contract check mirroring the update site's ingest guards, and a build
  reproducibility check.
- Distribution through the shared CaeloWorks update repository, alongside the
  zip on GitHub Releases.
- **Linear input is supported again**, under its own switched section, with a
  choice of screen transfer or statistical stretch. It was withdrawn in 3.0.0
  after four failed attempts; all four traced back to a target defined relative
  to the reference channel, which on linear data leaves everything on the floor.
  The target is absolute now. Validated against a reference set of linear
  masters.
- **A Complete preview target**: the screen combination of the starless image and
  the stars, which is what Execute writes when the combination is ticked.
- An icon on **Reset all**.

### Fixed
- **A corrupt `styleIndex` no longer bricks the dialog.** `NaN` satisfies neither
  bound of the range guard, so it passed through and `fxStyle` returned
  `undefined`; the migrations dereference that before the sanitiser can clean it,
  so one bad settings file threw out of `main()` and the dialog then failed to
  open on every launch afterwards, with no recovery from inside the script.
- **Schema-gated migrations run on the process-icon path again.** Settings are
  loaded first, which advanced the schema, so an icon that predates it left it
  advanced and every migration returned at its own first line.
- **"Reset all" no longer rewinds the migration schema**, which re-armed one-shot
  migrations — a Luminance preview target chosen afterwards came back as
  Starless the next session.
- **The preview no longer serves stale pixels.** Its downsampled copies are keyed
  on image identifiers, so editing a channel in place left **Refresh** redrawing
  the pre-edit data while its tooltip promised the opposite. Refresh now releases
  them.
- **The star channel cache survives a starless render.** It was being destroyed
  on every one, making the documented independent caching half false.
- **Hidden temporaries are no longer orphaned** when a channel copy throws
  part-way through.
- **The controls are locked during Execute.** Only three were disabled, while the
  render reads the parameters incrementally — a slider nudged mid-run spliced two
  parameter sets into one image, and the console report then described a run that
  never happened.
- **The linear-data warning is no longer discarded** whenever a multiscale stage
  is on: one status message overwrote the line instead of appending to it.
- **"Levels reset", "Created …" and "No histogram yet" stay on screen.** Each was
  erased about half a second later by the preview refresh it had itself started.
- **`fxValidate` validates the images the pipeline renders.** It re-resolved
  stale view wrappers into a local and discarded them, so a window closed during
  the session surfaced as a thrown error rather than the validation report.
- **The HDR section is genuinely switched.** Its expression builder never read
  the section's own switch.
- **The preview runs again.** A second `onShow` handler added while making the
  settings column scroll replaced the one that marked the dialog initialised and
  asked for the first render.
- **A missing 32-bit float enumerator no longer degrades the output silently.**
  `PixelMath` is asked for `f64` before falling back to the source format, and
  the fallback warns once a run: on a 16-bit source it makes every image the run
  produces a 16-bit integer, which bands in exactly the transition zones the
  palette is built around.
- **Closing the dialog during a preview no longer crashes PixInsight.** The
  event loop is pumped from inside a running process, so `onHide` fires between
  two pipeline stages; releasing the engine's channels and sweeping the
  temporaries there freed views the next process was about to read, which came
  back as an access violation rather than anything a script could catch. A hide
  during a render now only asks, and the render tears down in its own `finally`.
  The **Reload image list** and **Refresh** buttons released the same views
  through the same window and are guarded too.
- **`HDRMultiscaleTransform` and `UnsharpMask` failures are no longer reported as
  the process being absent.** A missing process and a process that refused the
  image are distinguished, and neither is recorded by the console report as
  having run.

### Removed
- **The two-pass green removal and the hue-weighted colour boost on the star
  image.** A star field's green is real broadband colour; the combination and
  the brightness stretch are the whole treatment now, and nothing corrects the
  colour afterwards. `starCleanGreen` and `starSaturation` are gone from the
  parameters, the dialog and the persisted settings.
- **The "supply non-linear images" banner**, which had been false since linear
  input was reinstated and was the first line anyone read. The auto-stretch
  notice that replaced it in the other state is gone too.
- The two draggable panel dividers, and `FXSplitter.js` with them.
- The empty "linear input" section headers left in the parameter object and the
  dialog when 3.0.0 withdrew linear support.

## [3.0.1] — 2026-08-27

### Changed
- The Foraxx amount and the two transition sliders grey out on the fixed
  palettes, which are straight permutations of the channels and have no
  transition to shape. The amount is held at 0 there as well, so a greyed slider
  can never hide a value restored from a settings file or a process icon.

## [3.0.0] — 2026-08-27

### Removed
- **Linear input support.** The script now takes non-linear (stretched) images
  only, stated in the file header, the Feature Scripts blurb and the dialog
  banner. The auto stretch never held up across real linear data — four separate
  faults were found and fixed between 2.3.4 and 2.6.1 and it still failed — so
  the claim was withdrawn rather than patched further.

### Kept
- Channel normalization, which works on stretched data and is what brings Sii,
  Ha and Oiii to a common brightness. The status line still warns, in capitals,
  when the selected channels look linear.

## [2.7.0] — 2026-08-27

### Changed
- The histogram belongs to the image the preview is showing. Starless, stars and
  the luminance layer each keep their own black point, midtones and white point;
  switching target restores that image's markers, and at Execute each set is
  applied to its own image only.
- The combined view is gone from the preview; the `_combined` output is
  unaffected. A preview showing the stars no longer builds the whole starless
  pipeline to throw it away.

### Fixed
- One set of markers described the starless histogram and was applied to the
  starless image whatever was on screen, so adjusting them while examining the
  stars quietly crushed the nebula. Changing a source image now resets every set
  and says so, and the status line names any set in force but not on screen.

## [2.6.1] — 2026-08-27

### Fixed
- Linear input produced a washed-out image on a grey floor. Star frames were
  being solved their own auto stretch; a star-only frame is almost all empty
  background, so putting its median on the 0.25 target lifted the void to mid
  grey. Star frames now share the nebula's midtones curve but keep their own
  black point.

### Changed
- Default star brightness is 1.00 rather than 0, and the preview says so when
  the selected channels look linear but the switch is off.

## [2.6.0] — 2026-08-27

### Added
- The artificial luminance carries its own black point, stretch amount and white
  point, acting before the substitution back into the colour image.
- Star brightness and star colour boost return as sliders, both starting at 0.

### Changed
- No author name appears anywhere in the interface. The licence notice in the
  file header is kept because the licences it names require it; it is a source
  comment and is never shown on screen.

## [2.5.0] — 2026-08-27

### Changed
- Fewer choices, better defaults. Stars are one fixed combination at the
  reference script's own ratios with its four-step green removal.
- Green/magenta suppression is PixInsight's SCNR at average neutral, with no
  mode selector.
- Artificial luminance is ChannelExtraction in CIE L\*a\*b\*, taking L.
- Every palette carries both transitions, with the Foraxx amount at 0 on the
  fixed ones. Transitions belong to the RGB slots rather than the channels.
- Settings files and process icons from earlier versions are migrated.

### Removed
- Star masks, the Ha/Oiii ratio, the standalone brightness stretch and colour
  boost, the three protection modes, the hue selectivity weight, the
  background-cast correction, and the luminance method selector.

## [2.4.0] — 2026-08-27

### Changed
- Star adjustments follow the published broadband method and its defaults again.
  The brightness stretch and its colour boost are one optional stage, off by
  default; green removal stays on.
- NB to RGB is the default star combination.

### Removed
- The per-channel background subtraction added in 2.3.1.

## [2.3.5] — 2026-08-27

### Fixed
- Previewed stars looked nothing like the ones Execute produced: the preview
  averaged star channels down before a stretch that multiplies by 243. Star
  channels are now downsampled peak-first, taking the worst gap from 0.60 to
  0.0013.

## [2.3.4] — 2026-08-27

### Fixed
- On linear input the nebula came out black. The auto stretch's midtones balance
  was clamped at 0.001 and the expression writer could only emit six decimals.
- With channel normalization on, the target came from the reference channel's
  raw linear median, pinning every channel to that clamp.

## [2.3.3] — 2026-08-27

### Changed
- HDR and local contrast is a switched section, off by default with every amount
  at zero.
- Green/magenta suppression no longer touches the star image; the stars have
  their own green removal.

## [2.3.2] — 2026-08-27

### Changed
- Preview zoom is continuous and anchored on the cursor. Fit, 1:1 and step
  buttons replace the zoom list; double click returns to Fit; panning can no
  longer push the image out of the panel.

## [2.3.1] — 2026-08-25

### Fixed
- The Foraxx star path finished with a near-identity curve, so a star at 0.01
  came out at 0.06 where the broadband path put it at 0.71. The star finishing
  chain is now shared by both star combinations.

## [2.3.0] — 2026-08-25

### Added
- Channel normalization and a background cast protection mode.
- A separate Detail control for render sampling; zoom became a display
  transform.

### Changed
- Execute no longer closes the dialog.

### Fixed
- In HOO, OHH and dynamic HOO the per-pixel green and magenta suppression was a
  no-op.

## [2.2.0] — 2026-08-25

### Added
- The Andy Warhol style, the statistical stretch and knee-based HDR compression,
  the broadband star combination, an artificial luminance layer, mouse wheel
  zoom, a line-drawn histogram, and draggable splitters.

### Changed
- Palette and preset merged into one style list, each carrying its own output
  name.

## [2.1.0] — 2026-08-25

### Added
- Palette modes (dynamic SHO/HOO plus every fixed mapping), per-slider reset
  buttons, tooltips on every control, a draggable histogram driving a levels
  transform, independent star stretch and saturation, linear input with an
  STF-style auto stretch, HDR compression, HDRMultiscaleTransform and local
  contrast.

### Fixed
- The stars stretch was applied to the hue channel; it now acts on RGB/K.

## [2.0.0] — 2026-08-25

### Added
- First release. Live preview, channel weighting, adjustable transitions,
  scalable curves and saturation, hue-selective green/magenta suppression,
  presets, settings persistence and process icon support.
