<div align="center">

# Foraxx Palette Studio

### Narrowband palettes with a live preview that is the real thing, not an approximation

[![Version](https://img.shields.io/badge/version-3.0.1-22d3ee?style=for-the-badge&labelColor=0f172a)](https://github.com/caelo-works/foraxx-palette-studio/releases/latest)
[![PixInsight](https://img.shields.io/badge/PixInsight-%E2%89%A5%201.8.9-67e8f9?style=for-the-badge&labelColor=0f172a)](https://pixinsight.com/)
[![Status](https://img.shields.io/badge/status-stable-34d399?style=for-the-badge&labelColor=0f172a)](https://pixinsight-scripts.caelo.works/en/scripts/foraxx-palette-studio)
[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-94a3b8?style=for-the-badge&labelColor=0f172a)](LICENSE)
[![Website](https://img.shields.io/badge/%E2%86%92%20see%20all%20scripts-pixinsight--scripts.caelo.works-0f172a?style=for-the-badge&labelColor=22d3ee)](https://pixinsight-scripts.caelo.works/en)

[![CaeloWorks · PixInsight Scripts](https://pixinsight-scripts.caelo.works/assets/readme-banner.png)](https://pixinsight-scripts.caelo.works/en)

</div>

---

## Overview

A PixInsight script for narrowband palette construction — dynamic Foraxx and the classic fixed
mappings — with a live preview, per-channel weighting, independent star controls, a draggable
histogram, HDR compression and hue-selective green/magenta suppression.

It began as a rewrite of the **Foraxx Palette Utility** by Paul Hancock, which implements Bill
Blanshan's dynamic PixelMath expressions. In *Foraxx — dynamic SHO* at default settings its
**starless** image is the same as the original's, bit for bit; everything else sits around that
core as parameters. The stars are the one deliberate departure — see 2.3.1 below.

> ## ⚠ THIS SCRIPT REQUIRES NON-LINEAR (STRETCHED) IMAGES
>
> **Stretch every channel before you run it** — with HistogramTransformation, a masked stretch, or
> whatever you normally use. **LINEAR DATA IS NOT SUPPORTED** and will produce a black or
> washed-out result. The status line under the preview tells you, in capitals, if the channels you
> selected look linear.

---

## Installation

### Through the CaeloWorks update repository (recommended)

Updates then arrive on their own, along with every other CaeloWorks script.

1. In PixInsight: **Resources → Updates → Manage Repositories**.
2. **Add** `https://pixinsight-scripts.caelo.works/update/`.
3. **Resources → Updates → Check for Updates**, then restart PixInsight.

The repository is not yet signed with a Certified PixInsight Developer identity, so PixInsight
warns that it is unsigned. That is expected.

### From the zip

1. Download the latest zip from [Releases](../../releases).
2. Unpack it over your PixInsight installation directory — it carries the
   `src/scripts/CaeloWorks/…` tree PixInsight expects — or unpack it anywhere and point
   **Script → Feature Scripts… → Add** at the
   `src/scripts/CaeloWorks/ForaxxPaletteStudio` folder inside it.

Either way it appears under **Script → CaeloWorks → Foraxx Palette Studio**.

Requires PixInsight 1.8.9 or later; developed and checked against the 1.9.x API.

---

<details>
<summary><b>Previous changelog</b></summary>

<br>

### What's new in 3.0.1

- **The Foraxx amount and the two transition sliders grey out on the fixed palettes.** SHO, HSO,
  HOO, OHH and the rest are straight permutations of the channels — there is no transition to
  shape, so the three controls that shape one are disabled. The amount is also held at 0 on those
  palettes, so a greyed slider can never be hiding a value restored from a settings file or a
  process icon.

---

### What's new in 3.0.0

**Linear input support is removed. This script takes NON-LINEAR (stretched) images only.**

The auto-stretch never worked reliably across the range of linear data people actually have. Four
separate faults were found and fixed in it between 2.3.4 and 2.6.1 — a clamped midtones balance, an
expression writer that couldn't hold small constants, a normalization target taken in the wrong
units, and star frames conditioned against their own empty background — and it still didn't hold up.
The honest thing is to stop claiming it rather than keep patching it.

The requirement is now stated in three places: the file header, the Feature Scripts description, and
the dialog banner. The status line still warns, in capitals, if the channels you selected look
linear — a sky background one to three orders of magnitude below where a stretched frame sits.

**Channel normalization stays.** It works on stretched data and is what brings Sii, Ha and Oiii to a
common brightness before they're combined — which is the thing most SHO images actually need.

---

### What's new in 2.7.0

**The histogram belongs to the image the preview is showing.**

There was one set of markers. It described the starless histogram and was applied to the starless
image no matter which target was on screen — so adjusting it while examining the stars quietly
crushed the nebula. And because the markers are remembered between sessions, a black point tuned on
an earlier, already-stretched frame was reapplied to a fresh linear render. That is exactly why the
stars looked right while the nebula did not: the stars had no markers of their own, so they got an
identity transform, while the nebula got a stale one.

- **Starless, stars and the luminance layer each keep their own black point, midtones and white
  point.** Switch the preview target and the panel brings that image's markers back and redraws the
  histogram from that image. At Execute each set is applied to its own image and to nothing else.
- **Changing a source image resets every set**, and says which ones were carrying something. Levels
  are tuning for one particular pair of images; carrying them across is the bug above.
- **The status line names any set that is in force but not on screen**, so a black point you can't
  currently see can't silently shape what you build.
- **The combined view is gone from the preview.** The `_combined` output is unaffected — it is
  still produced at Execute when the box is ticked, now built from both images after each has had
  its own levels.
- The luminance layer's three separate sliders are gone; the histogram drives them, like the other
  two images.
- A preview showing the stars no longer builds the entire starless pipeline just to throw it away.

---

### What's new in 2.6.1

**Fixed: linear input produced a washed-out image on a grey floor.**

The star frames were being solved their *own* auto-stretch. A star-only frame is almost entirely
empty background with a sparse population of peaks — so its median *is* that background. Putting
that median on the 0.25 target lifted the empty sky to mid grey and drove every star past 0.92, and
because the screen combination `~(~a·~b)` can never go below the brighter input, the whole finished
image inherited that floor.

Taking the nebula's map wholesale is wrong the other way: its black point removes a sky pedestal the
star frame no longer has, so it subtracts the sky twice and every faint star clips to zero.

| star frame value | own map (the bug) | nebula's map | shared curve, own black point |
|---|---|---|---|
| background 1.5e-5 | 0.250 | 0.000 | **0.018** |
| faint star 5e-4 | 0.918 | 0.000 | **0.373** |
| bright star 5e-2 | 0.999 | 0.984 | **0.984** |

So the **curve** is shared — that is what keeps the two frames on one brightness scale, which is
what the screen combination needs — and the **black point** is measured per frame, which handles
whichever pedestal convention your star removal left behind.

- **Default star brightness is now 1.00** rather than 0. On conditioned linear data that gives a
  0.05 sky, 0.64 for a faint star, 0.99 for a bright one. It suits already-stretched input too.
  5.00 lifts a conditioned sky to 0.81 — a white background — so raise it only if your stars really
  are still faint.
- **The preview now says when your channels look linear but the switch is off.** That combination
  gives a black preview and no explanation, which is an easy afternoon to lose.

---

### What's new in 2.6.0

- **The artificial luminance has its own black point, stretch amount and white point.** The
  histogram under the preview drives the *colour* image, and it is applied after the luminance
  layer has already been extracted — so the layer came out as flat as the data arrived, and that
  flat layer was then substituted back into the colour image. The three new controls act on the
  layer before the substitution, so the preview's **Luminance** target shows exactly what Execute
  writes out.
- **Star brightness and star colour boost are back as sliders.** Both start at 0, so the
  combination and the green removal are all that happens until you move them. The brightness curve
  is `((3^k)*$T)/((3^k-1)*$T+1)` — fixes 0 and 1, monotonic, so it lifts faint stars without
  clipping a bright core. Above about 5 on stars that were already stretched it will drive every
  core to flat white; watch the preview.
- **No name appears anywhere in the interface.** The tooltips, section notes, header banner and
  console report are all name-free, and the link button in the footer is gone.

  The **licence notice at the top of `ForaxxPaletteStudio.js` is kept.** Some of the methods this
  script builds on are published under licences that require attribution — one of them, CC BY-NC
  4.0, requires it explicitly — so removing it would put the script in breach. It is a source
  comment and is never shown on screen. If you want it changed, that is a licensing decision rather
  than a formatting one; say so and I will explain the options.

---

### What's new in 2.5.0

Fewer choices, and the ones that are left are PixInsight's or the reference script's rather than
this script's inventions.

- **The stars are NBtoRGBStars and nothing else.** One fixed combination at Franklin Marek's own
  ratios — `R = 0.5·Ha + 0.5·Sii`, `G = 0.3·Ha + 0.7·Oiii`, `B = Oiii` — followed by his four-step
  green removal. That is the whole Stars section now: one tick box. The Foraxx star-mask option,
  the Ha/Oiii ratio, the brightness stretch and the colour boost are gone. Having them was what
  kept producing star fields that didn't look like the reference.
- **Green / magenta suppression is PixInsight's SCNR**, average neutral, and there is no mode
  selector. The three protection modes, the hue-selectivity weight and the background-cast
  correction are gone. Green goes through SCNR directly; magenta through invert / SCNR / invert,
  which is how the stock process is normally used for it. *Preserve lightness* is SCNR's own option
  and stays.
- **The artificial luminance is extracted the way PixInsight extracts one**: ChannelExtraction in
  CIE L\*a\*b\*, taking L — the same thing as *Image > Extract > Lightness*. No method selector.
  The weighted means and channel maxima this used to offer were inventions of this script, and none
  of them was what PixInsight calls a luminance.
- **The preview can show the luminance.** A target alongside Starless and Stars. You
  can look at the layer without switching the Artificial luminance section on — it is only written
  out when that section is on.
- **Every palette now has both transition sliders.** The fixed palettes start with the Foraxx
  amount at 0, which is exactly the plain mapping they always were, so nothing changes until you
  move something. Turn the amount up and the transitions come alive on any palette. The **Sii/Ha**
  transition greys out on a palette that has no Sii; the **Ha/Oiii** one is always available.

  The transitions belong to the RGB **slots**, not to the channels: red carries the Sii↔Ha
  transition, green the Ha↔Oiii one, blue is the anchor, and each is mixed towards whatever channel
  that slot holds in this palette's mapping. That is what makes a fixed palette arrive *exactly* at
  the Foraxx palette with the same mapping as you raise the amount — verified to zero deviation for
  both SHO and HOO. Blending per channel instead would have driven green and blue to the same
  expression on any mapping that repeats a letter.

  A settings file or process icon from an earlier version is migrated on load: the fixed palettes
  used to store a Foraxx amount of 1.00 that nothing read, and restoring that verbatim would have
  turned a plain SHO into a full dynamic Foraxx without you touching anything.

---

### What's new in 2.4.0

**The star adjustments are SetiAstro's NBtoRGBStars again, defaults included.**

Since 2.3.1 the brightness stretch was applied unconditionally at 3^5 = 243. NBtoRGBStars ships it
behind an unticked box labelled *Apply Star Stretch (Recommended)* — it is optional there, and off
until you ask for it. That difference was survivable while the linear auto-stretch was broken and
handed the star channels over thirty times too dark; the 243× was quietly compensating. Once 2.3.4
fixed the linear stretch, 243× on top of a properly exposed channel drove every star core to flat
white.

What changed:

- **Apply star stretch** is a tick box, off by default, exactly as in the reference. The **stretch
  factor** and the **colour boost** both belong to it — that is where the colour boost lives in
  NBtoRGBStars too, because there is very little saturation to find in unstretched stars.
- The expression is written the way the reference writes it, `((3^k)*$T)/((3^k-1)*$T+1)`, with 3^k
  left for PixelMath to evaluate rather than pre-computed and rounded.
- **Green removal stays on** — SCNR, `mtf(0.01)`, SCNR, `mtf(~0.01)` — because the reference always
  does it.
- **The per-channel background subtraction added in 2.3.1 is gone.** It was reasoning about a
  residual pedestal the reference simply does not correct, and with the stretch off by default
  there is nothing left for it to protect against.
- **NB to RGB is now the default combination.**

The one style that still asks for the stretch is **Andy Warhol**, which is meant to be extreme.

---

### What's new in 2.3.5

- **Fixed: previewed stars looked nothing like the ones Execute produced.** The preview downsamples
  the channels to keep the pipeline live, and it was averaging the star channels — before the star
  finishing chain multiplies by 3^5 = 243. A star is a handful of bright pixels in a field of
  background, so averaging a 1:8 block dilutes a peak of 0.05 down to 0.0033, and the stretch has
  nothing left to lift. The previewed star reached 0.43 where the final one reached 0.93.

  Because the resampling happens *before* a strongly non-linear stage, `f(mean)` is nothing like
  `mean(f)`. The star channels are now downsampled **peak-first** — the brightest pixel of each
  block rather than their mean — which recovers the peak exactly. Worst-case gap between preview
  and final: **0.60 → 0.0013**. The nebula channels stay averaged, which is right for them.

  PixInsight's downsample mode is not something this codebase could confirm against a shipping
  script, so the request is made, read back, and the status line tells you if it was refused.

---

### What's new in 2.3.4

- **Fixed: on linear input the nebula came out black while the stars looked right.** The auto
  stretch solves a midtones balance to move each channel's median onto the target. That balance was
  clamped at 0.001 — roughly forty times larger than a sky background of 3e-5 needs — and the
  expression writer emitted only six decimals, so a balance of 2.5e-5 kept two significant figures
  and one of 3e-6 kept none. The background landed at 0.008 where 0.25 was asked for.

  | sky background | before | after |
  |---|---|---|
  | 5.0e-3 | 0.250 | 0.250 |
  | 1.0e-3 | 0.219 | 0.250 |
  | 2.0e-4 | 0.053 | 0.250 |
  | 3.0e-5 | 0.008 | 0.250 |

  The stars hid it: the star finishing chain lifts by 243 on top of the stretch and rescues almost
  anything.

- **Fixed: Linear input *and* Channel normalization together were worse still.** The normalization
  target came from the reference channel's median in raw linear units — of order 1e-4 — so every
  channel was pinned to the 0.001 clamp, 250× darker than the stretch target. Normalization is a
  relative statement, and it now multiplies the stretch target rather than replacing it.
- The auto stretch now **warns on the console** instead of silently leaving a channel linear: a
  non-finite median, no signal above the black point, or a balance below the floor each say so.

---

### What's new in 2.3.3

- **HDR and local contrast is a switched section**, off by default, with every amount at 0. Nothing
  in it runs unless you ask for it. A settings file or process icon from an earlier version that
  carried non-zero amounts switches the section on by itself, so an existing setup keeps producing
  what it produced before rather than silently losing the stage.
- **Green / magenta suppression no longer touches the star image.** It is tuned for green that comes
  from the channel imbalance in a nebula; a star field's green is real broadband colour, and running
  the same correction over it flattened white and yellow stars towards grey. The stars keep their
  own two-pass green removal under **Remove green from the stars**, which is now the only green
  removal they get.
- Switched sections now expand and collapse to follow their own tick box after **Reset all** or a
  process-icon import, instead of leaving the tick and the section disagreeing.

---

### What's new in 2.3.2

- **Continuous, cursor-anchored preview zoom**, following the geometry of SetiAstro's
  statisticalstretch. A wheel notch multiplies the scale by 1.25 or 0.8 rather than jumping between
  six fixed steps, and the zoom happens *about the cursor* — whatever pixel is under the pointer
  stays under it — instead of about the centre of the panel. 1.25 × 0.8 = 1 exactly, so a notch in
  and a notch back out returns to precisely where it started.
- The zoom list is gone; **Fit**, **1:1**, **−**, **+** and a live percentage take its place, and a
  **double click anywhere in the panel returns to Fit**.
- Fixed: **panning could push the image out of the panel.** The drag handler translated the scroll
  position without clamping it to the scroll range.
- Fixed: **a notch could move the zoom the wrong way.** When Fit lands outside the wheel's own
  0.1×–10× range — a 9576 px frame at 1:1 detail in a 900 px panel fits at 0.094× — clamping the
  notch into that fixed range made wheel-*down* enlarge the image, and the next notch then did
  nothing at all. The current scale now widens the window it is clamped into, so a notch either
  moves the way the wheel was turned or does nothing.

---

### What's new in 2.3.1

- **The star finishing chain is now shared by both combinations.** Green removal, the brightness
  stretch and the colour boost used to belong to the NB to RGB path; picking **Foraxx** got you
  none of them.
- **Fixed: Foraxx star fields came out dim.** The original ends the star path with its signature
  curve, which over the range stars actually occupy is very nearly the identity. Measured against
  the stretch SetiAstro applies:

  | star at | original Foraxx star curve | shared stretch, brightness 5.00 |
  |---|---|---|
  | 0.002 | 0.056 | 0.328 |
  | 0.010 | 0.061 | 0.711 |
  | 0.050 | 0.084 | 0.928 |
  | 0.200 | 0.198 | 0.984 |

- **The star background is zeroed before the stretch.** A stretch that strong lifts the residual
  background of a star image as hard as it lifts the stars — a residual of 0.002 arrives at 0.33 —
  and because the combined view is a screen blend, `~(~a·~b)` can never go darker than the brighter
  input. Left alone that residual becomes the black point of the finished image. Each channel now
  has its own measured background subtracted and rescaled first.
- The **Stars** section greys out as a whole, header included, when no star images are in use.

---

### What's new in 2.3.0

- **Zoom no longer re-renders.** The zoom control and the mouse wheel scale the preview you already
  have; the pipeline is not run again. A separate **Detail** control sets the sampling the pipeline
  actually runs at — Auto renders at twice the panel resolution, so zooming to 200% is still pixel
  exact, and 1:1 is there when you want to inspect the real thing.
- **Execute keeps the dialog open.** Build a palette, change the palette, build another. Each run
  gets its own set of image names and its own console report. **Close** is the only way out.
- **Channel normalization**, after Mike Cranfield's NarrowbandNormalization. This is the real fix
  for the green and magenta problem — see below.
- **A third protection mode, "Background cast"**, for the palettes where the per-pixel modes have
  nothing to find.

### Why green and magenta "didn't work so much"

Two separate reasons, and neither was a bug in the suppression itself.

**In HOO, OHH and the dynamic HOO it was mathematically impossible.** Green in those palettes is
built from the very channels that make red and blue:

| Palette | R | G | B |
|---|---|---|---|
| HOO | Ha | Oiii | Oiii |
| OHH | Oiii | Ha | Ha |
| Foraxx HOO | Ha | `ho·Ha + (1−ho)·Oiii` | Oiii |

In every one of them G is bounded by R and B, so `G − max(R,B) ≤ 0` and `min(R,B) − G ≤ 0`: the
green excess *and* the magenta excess are identically zero, everywhere, and the correction was
correctly removing nothing. The test suite now proves this over the whole colour cube — the
measured maximum excess is 0 for all three.

**In SHO it was the wrong question.** Ha is typically several times stronger than Sii and Oiii, so
the whole frame carries green excess. A per-pixel correction is then either invisible or ruinous;
there is no setting in between. The imbalance has to be fixed *before* the channels are combined.

**The fix.** Tick **Channel normalization**. Each channel gets a black point interpolated between
its minimum and its median, then a midtones curve that moves its median onto the reference
channel's — a curve stretch, not a linear scale, so faint structure is lifted without the bright
cores running away. **Sii level** and **Oiii level** then let you place each channel above or below
the reference deliberately. With the channels balanced, SHO stops being green and the per-pixel
suppression has something meaningful to do.

For the bracketed palettes, use the new **Background cast** protection mode. Instead of comparing
green with red and blue at each pixel, it measures the image's own per-channel medians and removes
the global multiplicative imbalance between them. One correction covers both directions: green
above the red/blue mean is a green cast, below it is a magenta cast. The status line tells you when
you have a per-pixel mode selected on a palette that cannot produce green or magenta.

### On the NarrowbandNormalization module

I could not read the `.dll` you sent — it is compiled x86-64 machine code, and the `.xsgn` is only
its code signature. What is implemented here follows the module's *published* method (a black point
interpolated between minimum and median, then a curve stretch bringing Sii and Oiii up to Ha's
level, with per-channel boosts), not its binary. It is a reimplementation of a documented approach,
not a port. For the full process — LAB lightness modes, blend modes, the highlight and shadow
controls — install Mike Cranfield's module itself; it does more than this stage does.

### Previously, in 2.2.0

- **One palette list.** The palette and the preset were two controls that fought each other, so
  they are now a single **Palette** list at the top, right under the channel selection. Each entry
  sets the channel mapping, every tuning slider *and* the output image name at once — a Warhol run
  lands in `Warhol`, an HSO run in `HSO`.
- **Channel count is back.** Explicit 2-channel / 3-channel radios, plus **Starless only**, at the
  top of the dialog. Switching to 2 channels moves a Sii palette to its Ha/Oiii equivalent.
- **Andy Warhol palette.** Hard transitions, saturation pushed to the limit and the result
  posterised into flat blocks of colour. Its two ingredients — **Overall saturation** and
  **Posterise levels** — are ordinary sliders you can use on any palette.
- **SetiAstro methods, from the two scripts you sent.** *Statistical stretch* never places the
  black point above the darkest pixel in the frame, so nothing is discarded; the *NB to RGB* star
  combination gives far more believable star colour than running the nebula's dynamic masks over a
  star field. Both are selectable alongside the previous methods. The knee-based highlight
  compression from `statisticalstretch` replaces the earlier logarithmic curve.
- **Artificial luminance.** A synthetic luminance layer built from the channels — maximum, weighted
  mean, or the colour image's own lightness — produced as `name_L` and optionally substituted back
  into the colour image with a strength slider.
- **Resizable panels.** Drag the divider between the side bar and the preview, and the one between
  the preview and the histogram. Double click a divider to reset it. Both sizes persist. This is
  what fixes the truncated control labels.
- **Mouse wheel zoom** over the preview image.
- **Histogram drawn as line curves**, one outline per channel, instead of filled bars.

### A note on the highlight compression

The published Hermite curve uses an end slope of up to 5. Writing the derivative as
`f'(t) = 1 + (3t² − 2t)(m₁ − 1)`, whose minimum over [0,1] is `1 − (m₁−1)/3`, shows the curve stops
being monotonic once m₁ passes 4 — which *inverts* the upper midtones rather than compressing them.
The cap here is 4, so even the strongest setting stays monotonic.

### Previously, in 2.1.0

Per-slider reset buttons, tooltips on every control, the draggable histogram, independent star
stretch and saturation, linear input, and HDRMultiscaleTransform and local contrast.

**The stars stretch slider did nothing before 2.1.0, and in the original script.** The original
assigns the star curve to the CurvesTransformation *hue* channel. A stars image is close to
neutral, and a hue rotation of a near-grey pixel changes nothing you can see — so the curve was a
no-op in practice. Its shape (lifted black point, boosted midtones) is unmistakably a brightness
stretch, so it is now applied to RGB/K.

The two *starless* signature curves are also hue curves in the original. Those are left exactly as
they were: rotating reds towards gold and blues towards teal is a real part of what makes a Foraxx
image look the way it does.

</details>

---

## What it expects

Single-channel greyscale images, all the same size, and **NON-LINEAR — stretched before you bring
them here.** Linear data straight out of stacking is not supported; stretch each channel first.

- Modes containing **S** need Sii, Ha and Oiii.
- Modes without an S need only Ha and Oiii, and grey out the Sii rows.
- Star images are optional — tick *Starless images only* if your images still contain stars or you
  do not want a separate colour stars image.

---

## The controls

### Channel normalization (collapsed by default)

Tick the section's checkbox to enable it.

| Control | What it does |
|---|---|
| **Reference** | The channel every other one is brought up to. Ha is almost always the strongest, so it is the usual reference. |
| **Sii / Ha / Oiii level** | Where that channel's median lands, as a multiple of the reference's. 1.00 matches it exactly; **Oiii level** is the slider that decides how much teal the palette ends up with. |
| **Shadow point** | Where the black point sits, interpolated from each channel's darkest pixel towards its median. 0 puts it on the minimum and discards nothing. |

### Weighting, transition and colour

| Control | What it does |
|---|---|
| **Sii / Ha / Oiii weight** | Per-channel gain before the combination. This is a *soft* gain, `g·x / (1 + (g−1)·x)` — monotonic, maps 0→0 and 1→1 exactly, so it brightens faint signal without ever clipping bright cores the way a plain multiplication would. |
| **Foraxx amount** | 0.00 gives the ordinary fixed mapping, 1.00 the full dynamic blend. **Foraxx palettes only** — a fixed mapping is a straight permutation of the channels, so this and the two transition sliders grey out there. |
| **Sii/Ha transition** | Hardness `k` of the `o` mask, `o = Oiii^(k·~Oiii)` — where the red slot comes from Sii versus Ha. Needs a Foraxx palette *and* an Sii channel. |
| **Ha/Oiii transition** | Hardness of the `ho` mask, `ho = (Ha·Oiii)^(k·~(Ha·Oiii))` — the gold-to-teal boundary of the green slot. Foraxx palettes only, and usually the most consequential slider there. |
| **Signature curves** | Scales the original's two hue curves. 0.00 skips them, 1.00 is the original, 2.00 doubles them. |
| **Selective saturation** | Scales the global saturation curve and both selective saturation passes. |
| **Overall saturation** | A flat boost across every hue, on top of the selective pass. 0 leaves it alone. |
| **Posterise levels** | Quantises each channel to this many evenly spaced levels, so gradients become flat blocks of colour. 0 is off; 4 to 8 gives a recognisable poster. |

### Stars

The star field is a fixed broadband-style combination — stars are broadband sources, not line
emitters, so mixing them this way gives more believable colour than running the nebula's palette
over them:

```
R = 0.5·Ha + 0.5·Sii      (0.5·Ha + 0.5·Ha when you have no Sii)
G = 0.3·Ha + 0.7·Oiii
B = Oiii
```

| Control | What it does |
|---|---|
| **Remove green from the stars** | A two-pass green removal: remove green, push hard into the highlights with a midtones transfer, remove green again on the stretched data, then undo the push. Working on the stretched version is what lets the second pass reach the faint fringing the first one misses. On by default. |
| **Star brightness** | `((3^k)*$T)/((3^k-1)*$T+1)` — fixes 0 and 1 and is monotonic, so it lifts faint stars hard without ever clipping a bright core. **0 leaves the stars exactly as the combination produced them.** Above about 5 on stars that were already stretched, the multiplier is 243 and every core goes flat white. |
| **Star colour boost** | A hue-weighted saturation boost after the brightness stretch — the blue / white / amber spread of a star field. 0 leaves the colour alone. |

There is no combination choice and no Ha/Oiii ratio. Those were removed in 2.5.0: tuning them was
what kept producing star fields that didn't match.

Green / magenta suppression does **not** touch the stars. That stage is tuned for the nebula, where
green is an artefact of the channel imbalance; a star field's green is real broadband colour and the
same correction desaturates it into grey.

The combined view is a screen blend, `~(~starless · ~stars)`, so stars are added to the nebula
rather than pasted over it and never clip a bright core to flat white.

### Green / magenta suppression

Untick the section header to skip the stage entirely. It applies to the **nebula only**.

The stock **SCNR** process at average neutral — no reimplementation. **Green amount** is the amount
for the green pass. **Magenta amount** runs it as invert / remove green / invert. **Preserve
lightness** keeps the pixel's brightness where it was, and keeping it on is what stops the result
going flat and dim.

The three protection modes, the hue-selectivity weight and the background-cast correction that used
to live here were removed in 2.5.0. They were a second way of doing the same job with more knobs
and no better result.

### HDR and local contrast (off by default)

Tick the section header to enable the stage; leave it unticked and none of it runs. Every amount
here starts at 0, so even with the section on nothing happens until you move a slider. The
**compression knee** is the exception — it is a *position* in the tonal range, not an amount, so it
starts at 0.60 and has no effect at all while highlight compression is 0.

| Control | What it does |
|---|---|
| **Highlight compression** | Pulls the tones above the knee back towards it, on luminance, applied as a single scale factor to all three channels so hue and saturation survive intact. Entirely scale-invariant, so the preview matches the final image exactly. |
| **Compression knee** | The brightness above which compression starts. Everything darker is left completely alone. |
| **HDR multiscale layers** | PixInsight's HDRMultiscaleTransform. Far more effective on genuinely blown cores, but it works on spatial scales — **the preview is only indicative**. The layer count is capped to what the preview's pixel dimensions can actually support. |
| **Local contrast** | A large-scale unsharp mask on the luminance, to put back structure that HDR compression flattens. Also scale-dependent. |

The preview status line says so whenever a scale-dependent stage is active.

### Levels

The panel under the preview belongs to **the image the preview is showing**. Each of the three —
starless, stars, luminance — keeps its own black point, midtones balance and white point, and each
set is applied to its own image and to nothing else.

The histogram is that image as it stands immediately before its own levels transform, drawn as one
outline per channel on a logarithmic vertical scale. Drag the three triangles; double click one to
reset just it. **Auto** reads a starting point off the current histogram; **Reset** returns that
image's set to an identity and leaves the others alone.

Switching the preview target brings that image's markers back. Changing a source image resets all
three sets, because levels are tuning for one particular pair of images. If a set is in force on an
image you are not currently looking at, the status line says so.

### Artificial luminance (collapsed by default)

Tick the section's checkbox to produce a synthetic luminance layer named `name_L`.

It is the CIE L\*a\*b\* lightness of the colour result, taken as its own greyscale layer. Because it
is a standard lightness it behaves in an LRGB combination, in a mask or in a curve exactly as any
other luminance does. There is no method to choose.

To stretch it, set the preview **Target** to **Luminance** and use the histogram below the preview —
it belongs to whichever image is on screen, and the layer keeps its own three markers. They act
before the substitution below, so what you tune is what gets combined.

The Luminance target works with the section switched off; the layer is only written out when the
section is on.

**Apply to the image** is how much of it to substitute back into the colour result. 0 produces the
layer and leaves the colour image untouched, so you can combine them yourself; 1 fully replaces the
image's own lightness. The colour ratios are preserved either way, and the substitution stops where
a channel would clip.

### Output

Base identifier, plus optional screen combination and the `o` / `ho` factor images. The name follows
whichever palette you pick; type your own if you prefer, and it will be replaced the next time you
change palette. Existing identifiers are never overwritten: a numeric suffix is added to the whole
group at once, so `Warhol01`, `Warhol01_stars`, `Warhol01_combined` and `Warhol01_L` always match.

---

## The preview

The preview is not an approximation. The engine makes hidden, downsampled copies of your channels
once, then runs **the same pipeline the Execute button runs** on them — the same PixelMath
expression strings, the same process instances. The only difference is spatial sampling, and the
only stages where that matters are the two labelled above.

- **Target** — starless, stars, or the luminance layer. This also chooses which image the histogram
  belongs to.
- **Zoom** — roll the mouse wheel over the panel. The zoom is continuous and anchored on the
  cursor: one notch multiplies the scale by 1.25 or 0.8, and the pixel under the pointer stays
  under the pointer. **Fit**, **1:1**, **−** and **+** are there for the keyboard-and-trackpad
  route, the percentage beside them is the live scale, and a double click anywhere in the panel
  goes back to Fit. All of it is a display scale only: it repaints the image already in hand and
  never runs the pipeline again. Drag inside the panel to pan.
- **Detail** — the sampling the pipeline runs at. This one *does* re-render. Auto renders at twice
  the panel resolution; pick 1:1 to inspect the real result.
- **Auto** — re-renders about half a second after a control settles. Turn it off on very large
  images and use **Refresh**.

Starless and star channel sets are cached independently, so switching the preview target does not
resample anything it does not have to. All temporary images are hidden and closed when the dialog
closes.

---

## The palette list

| Entry | What it is | Output name |
|---|---|---|
| **Foraxx — classic** | The original script exactly, colour suppression off | `Foraxx` |
| **Foraxx — with colour clean-up** | The same, with the recommended suppression settings | `Foraxx` |
| **Foraxx — soft transition** | A less abrupt gold/teal boundary | `Foraxx_soft` |
| **Foraxx — gold forward** / **teal forward** | Shifts the balance | `Foraxx_gold` / `Foraxx_teal` |
| **Foraxx HOO** | The dynamic blend for Ha and Oiii only | `Foraxx_HOO` |
| **Andy Warhol** | Saturation pushed hard and posterised into flat colour | `Warhol` |
| **SHO, HSO, HOS, OHS, OSH, SOH** | Fixed three-channel mappings | the mapping |
| **HOO, OHH** | Fixed two-channel mappings | the mapping |

Entries that need Sii are hidden while you are in 2-channel mode.

---

## Layout

The two dividers are draggable: one between the side bar and the preview, one between the preview
and the histogram. Double click either to restore its default. Both sizes are remembered between
sessions. Sections collapse from their title bars if you want more room.

---

## Other notes

- Settings persist between sessions, and the **New Instance** button (bottom left) saves the
  current settings as a process icon. Only a run you accept with **Execute** becomes the new stored
  default; closing with **Close** leaves your previous settings alone.
- Output is always 32-bit floating point. The dynamic factors involve fractional powers, and
  rounding those into a 16-bit container produces visible banding in the transition zones.
- Everything is validated before anything runs: missing channels, colour images where greyscale is
  required, mismatched geometry and invalid identifiers are reported rather than thrown.
- **Reload image list** rescans the workspace — use it if you created or renamed images after
  opening the dialog.

---

## Credit and licence

**Nicolas Godingen** wrote Foraxx Palette Studio, and it is his throughout — the engine, the
interface, and every default in it, each one settled against his own narrowband masters rather
than guessed. The care is in the details a lesser tool would have skipped: a preview that runs the
real pipeline instead of approximating it, controls that emit no arithmetic at all while they sit
at their neutral position, and a version history honest enough to document what it got wrong
before it got it right.

The combination maths and the signature curves are the work of **Paul Hancock** (Foraxx Palette
Utility, © 2023–2024), implementing the dynamic PixelMath expressions published by
**Bill Blanshan** at [thecoldestnights.com](https://thecoldestnights.com/2020/06/pixinsight-dynamic-narrowband-combinations-with-pixelmath/).

This product is based on software from the PixInsight project, developed by Pleiades Astrophoto
and its contributors (<https://pixinsight.com/>).

---

## Licence

Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — share and adapt
freely for non-commercial purposes, with credit. The NonCommercial condition is inherited from
upstream work this script builds on and is not a choice; `LICENSE` explains why an OSI-approved
licence would misstate the terms. The full attribution chain is in
[NOTICE.md](NOTICE.md), which is part of the licence terms and travels with the script.

Maintained by [Caelo Works](https://caelo.works) with the agreement of the original author.
See [CHANGELOG.md](CHANGELOG.md) for release history, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for how it is put together, and [CONTRIBUTING.md](CONTRIBUTING.md) if you want to work on it.
