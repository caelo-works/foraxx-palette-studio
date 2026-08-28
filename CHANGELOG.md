# Changelog

All notable changes to Foraxx Palette Studio.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries up to 3.0.1 were reconstructed from the version history block in
`ForaxxPaletteStudio.js`, which remains the authoritative record for those
releases.

## [Unreleased]

### Changed
- Project taken over by Caelo Works for long-term maintenance and distribution.
- Repository, licence (CC BY-NC 4.0), attribution notice, packaging and release
  tooling added around the existing script. No behavioural change.

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
