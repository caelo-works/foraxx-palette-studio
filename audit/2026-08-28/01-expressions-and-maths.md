# 01 — Expressions and maths (`pjsr/lib/FXExpressions.js`, maths in `FXProcessing.js`)

Audit date: 2026-08-28. Scope: `pjsr/lib/FXExpressions.js` (437 lines, read in full) and the
pure maths in `pjsr/lib/FXProcessing.js` — `fxClamp` (38-41), `fxMTFValue` (106-116),
`fxSolveMTF` (118-148), `fxChannelStats` (157-211), `fxBlackPointFor` (241-259),
`fxMedianAfterBlackPoint` (261-264), `fxNormalizationBoost` (266-282),
`fxChannelTransform` (284-328), `fxStretchMapFor` (330-372), `fxScaleCurve` (422-432),
`fxScaleDeltaCurve` (434-443). Callers and ranges were read for reachability
(`FXParameters.js`, `fxCollectIds`, `fxCollectStretch`, `fxRenderParts`, `fxApplyStarFinishing`,
`FXPreview.js`). I ran the harness: `bash tests/run.sh` builds `tests/build/module.js` and
passes (1262 assertions); every numeric claim below was re-derived and then checked by driving
that bundle from `node`, including a float32 model of PixelMath's arithmetic.

## Executive summary

1. **The expression writer itself is in good shape.** I derived every formula in
   `FXExpressions.js` independently — the soft gain `gx/(1+(g-1)x)` (slope `g` at 0, fixes 0 and 1,
   monotonic, bounded by 1), the MTF and its solver (`m = x(1-y)/(x+y-2xy)`, verified as an exact
   inverse of `fxMTFValue`), the star curve `3^k·x/((3^k-1)x+1)`, the cubic Hermite in the HDR
   stage (`f' = 1 + (3t²-2t)(m₁-1)`, minimum `1-(m₁-1)/3`, hence the cap at exactly 4), the
   posterisation step count, and the `~0.01` MTF inverse in the star finishing chain
   (`MTF(1-m, MTF(m,x)) = x`). All of them are correct and all of the comments explaining
   *why* they are shaped that way are correct. No operator-precedence fault exists in any emitted
   string: every sub-expression is parenthesised at every composition point.
2. **The bit-for-bit invariant is safe.** `fxIsOne`/`fxIsZero` (1e-5) sit far below the 0.01
   slider granularity, so at defaults `fxGain`, `fxMix` and `fxDynamicFactor` all take their
   identity branches and the three published strings come out character for character. Nothing
   I found threatens that.
3. **One real default-output bug.** `FX.starStretch` ships at `1.00` while `README.md:167`,
   `CHANGELOG.md:102` and the source comment at `FXProcessing.js:849` all state the slider starts
   at 0. Every default run therefore applies `3x/(2x+1)` to the star image — a star at 0.05 comes
   out at 0.136, the star-frame background is lifted 2.7x, and the screen combination can never go
   back below it. This is H1 and it is the only High.
4. **Two tests do not test what they say.** `expressions.test.js:225` claims "the HDR section off
   emits no expression", but `fxBuildHDRCompression` never reads `p.hdrEnabled` — the assertion
   passes on the coincidence that `hdrAmount` defaults to 0, and would still pass if the flag were
   deleted. `expressions.test.js:240` claims "the division by luminance is guarded against zero"
   via a disjunction whose second half (`indexOf('iif(') >= 0`) is satisfied by the outer `iif`
   alone, and the guard it means to pin is unreachable anyway.
5. **`stats.madn` is dead.** `fxChannelStats` runs `image.MAD()` (with a `stdDev()` fallback) on
   every channel and stores the result; `grep -rn madn pjsr/` shows it is never read. The
   `FXExpressions.js` header nevertheless says `c0` and `m` "come from the channel's own median and
   MAD, exactly as PixInsight's screen transfer function computes them" — they come from the median
   and the minimum, and the target is the reference channel's median, not a "target background".
6. **The emitted expressions duplicate their operands heavily.** With normalization and non-unit
   gains on, the green expression is 2116 characters and names `Oiii` 20 times and `Ha` 10 times,
   because `hoBase` is textually re-expanded four times and each channel's stretch+gain expands its
   own operand twice more. `P.symbols` is `""` in both PixelMath wrappers, so nothing declares the
   shared factor.
7. **Everything else is small.** Six dead clamps, two vacuous-but-harmless guards, one spurious
   console warning naming a channel the render will not use, and one comment ("k < 1 makes the
   transition earlier and *softer*") that is backwards near black.

No Critical findings. Counts: High 1, Medium 4, Low 4, Nit 8.

---

## Findings

### High

#### H1. The star brightness slider ships at 1.00 when its documented, and intended, default is 0

- **Location:** `pjsr/lib/FXParameters.js:283` (`starStretch: 1.00`), against
  `pjsr/lib/FXProcessing.js:846-853` and `FXProcessing.js:868-889`,
  `pjsr/lib/FXExpressions.js:288-315`, `README.md:167`, `README.md:517`, `CHANGELOG.md:102`.
- **Evidence:** the source comment immediately above the code that consumes the value says:

  > *"Both sliders default to 0, which is deliberate. The brightness curve multiplies by 3^k — 243
  > at k = 5 — which is right for a star image that is still faint and ruinous for one already
  > stretched […] Having it on by default is what produced exactly that."*

  `README.md:167` — *"Both start at 0, so the […]"*. `CHANGELOG.md:102` — *"both starting at 0"*.
  `README.md:517` — *"**0 leaves the stars exactly as the combination produced them.**"*
  The shipped value is `1.00`. Its sibling `starSaturation` is correctly `0.00`.
  Driving the bundle:

  ```
  FX.starStretch = 1  ->  ((3^1.00)*$T)/((3^1.00-1)*$T+1)
    x=0.01  ->  0.0294      x=0.05  ->  0.1364     x=0.1  ->  0.2500
    x=0.2   ->  0.4286      x=0.5   ->  0.7500
  ```

  `fxBuildStarStretchExpression` returns `null` only for `k ≈ 0`, so at 1.00 the stage runs
  unconditionally inside `fxApplyStarFinishing`. Nothing else clears it: no entry in `FXStyles`
  sets `starStretch`, so selecting any palette leaves it at 1.00, `FXDefaults.starStretch` is 1.00
  so the per-slider reset button restores 1.00, and `fxSanitize` only range-clamps it against
  `FXRanges.starStretch = [0, 8]`.
- **Why it matters:** every default run brightens the *stars* image by a factor approaching 3 in
  the shadows — background included, not just the stars. The starless image and therefore the
  bit-for-bit promise are untouched, but the `_stars` output and the `_combined` output are both
  affected: `fxBuildCombineExpression` emits `~(~starless * ~stars)`, which can never fall below
  the brighter input, so a lifted star-frame background propagates straight into the combined image
  as a raised floor. That is the same failure mode the comment at `FXProcessing.js:849` describes
  as the reason the default was moved to 0, at a milder magnitude. Users following the README
  ("both start at 0") will not think to look at the slider.
- **Fix:** set `starStretch: 0.00` in `FXParameters.js`. If 1.00 was in fact a deliberate change,
  then `README.md:167`, `README.md:517`, `CHANGELOG.md:102` and the comment at
  `FXProcessing.js:846-853` all have to be corrected instead, and the change belongs in the
  changelog as a default-output change — but the weight of the documentation says the code is what
  is wrong.

### Medium

#### M1. `fxBuildHDRCompression` never reads `hdrEnabled`, and the test that claims to guard it is vacuous

- **Location:** `pjsr/lib/FXExpressions.js:377-405`; test at `tests/expressions.test.js:219-226`.
- **Evidence:** the function's only early exit is `if ( fxIsZero( p.hdrAmount ) ) return null;`.
  The test asserts:

  ```js
  eq( fx.fxBuildHDRCompression( P( { hdrEnabled: false } ) ), null,
      'the HDR section off emits no expression' );
  ```

  Driving the bundle with the flag off but the amount up:

  ```
  hdrEnabled=false, hdrAmount=0.5  =>  NON-NULL expression emitted
  ```

  The test passes only because `FX.hdrAmount` defaults to `0.00`; it exercises the amount check,
  not the enable check, and would pass unchanged if `hdrEnabled` were deleted from the parameter
  set. The comment above it names 2.3.3 — *"turned it into a switched section precisely so that
  nothing in it runs unless it is asked for"* — which is exactly the invariant the assertion does
  not cover.
- **Why it matters:** today the only caller, `fxApplyHDRCompression` at `FXProcessing.js:628`, is
  reached under `if ( p.hdrEnabled )` in `fxRenderParts:1240`, so no user-visible bug. But the
  switched-section invariant lives entirely in one `if` in the pipeline, with a test that
  advertises coverage it does not have. A settings file or process icon that restores
  `hdrAmount > 0` with `hdrEnabled false` is one dropped `if` away from silently compressing
  everyone's highlights, and the suite would stay green.
- **Fix:** add `if ( !p.hdrEnabled ) return null;` as the first line of `fxBuildHDRCompression`
  (it makes the builder self-describing and costs nothing), and change the test to
  `P( { hdrEnabled: false, hdrAmount: 0.5, hdrKnee: 0.6 } )` so it actually fails without the guard.

#### M2. `stats.madn` is computed on every channel and never read; the header claims the maths uses it

- **Location:** `pjsr/lib/FXProcessing.js:174-208`; the claim at `pjsr/lib/FXExpressions.js:19-27`.
- **Evidence:** `grep -rn "madn" pjsr/` returns only the seven lines inside `fxChannelStats` that
  compute and store it. Nothing in `fxBlackPointFor`, `fxMedianAfterBlackPoint`,
  `fxChannelTransform`, `fxStretchMapFor`, `fxSolveMTF` or `fxLooksLinear` reads `stats.madn`.
  The block costs an `image.MAD()` and, whenever MAD returns 0 or non-finite, a full
  `image.stdDev()` as well — both full-image statistics passes, per channel, per uncached view.
  The header of `FXExpressions.js` states:

  > *"c0 and m come from the channel's own median and MAD, exactly as PixInsight's screen transfer
  > function computes them, so an auto-stretched channel lands at the requested target background."*

  Neither half is true. `c0` is `min + normShadow·(median − min)` (`fxBlackPointFor:241-259`) and
  `m` solves the channel's post-black-point median onto `referenceMedian × boost`
  (`fxChannelTransform:305-327`) — MAD appears nowhere, and there is no "requested target
  background": the target is relative to the reference channel, which is precisely the point
  `FXProcessing.js:222-228` and `tests/normalization.test.js:126-158` are at pains to make.
- **Why it matters:** the header is the first thing a maintainer reads, and it describes an STF-style
  MAD-driven autostretch that does not exist — the exact confusion the linear-input section of
  `normalization.test.js` was written to prevent. The wasted MAD/stdDev passes are cached per view
  id, but they are paid once per source channel on the first preview and again after every
  `fxClearStatsCache()` in `fxRenderFinal`.
- **Fix:** either delete `madn` from `fxChannelStats` and rewrite the `FXExpressions.js` header
  paragraph to describe what the code does (black point interpolated from the minimum towards the
  median; midtones balance solved so the channel's median lands on the reference channel's median
  times its boost), or keep the field and say in a comment what it is being kept for. Do not leave
  the header describing an algorithm the code does not implement.

#### M3. `fxBuildExpressions`'s `valueCtx` parameter is dead in production; the architecture and a test document behaviour nothing reaches

- **Location:** `pjsr/lib/FXExpressions.js:215-267`; the only call site is
  `pjsr/lib/FXProcessing.js:1225`; documented at `docs/ARCHITECTURE.md:60-62`; pinned at
  `tests/expressions.test.js:102-117`.
- **Evidence:** `grep -rn "fxBuildExpressions" pjsr/` yields exactly one production call:

  ```js
  let e = fxBuildExpressions( p, maskCtx, maskCtx );
  ```

  Both arguments are the same object, so `v` and `m` in `fxBuildExpressions` are always identical.
  The star image no longer goes through this function at all — `fxRenderParts:1286` builds it with
  `fxBuildStarRGBExpressions( p, valueCtx )`, the broadband combination, and the surrounding comment
  explains that running the nebula's dynamic masks over a star field was rejected. `ARCHITECTURE.md`
  still presents the split as live: *"The masks always come from the **starless** context even when
  the values come from the star channels — `fxBuildExpressions( p, maskCtx, valueCtx )`. That is the
  original's behaviour and is deliberate."* And `expressions.test.js:108-117` builds
  `fxBuildExpressions( P({styleIndex:0}), THREE, stars )` — a call shape no shipped code path makes.
- **Why it matters:** three of the file's most careful comments (`FXExpressions.js:215-224`,
  `ARCHITECTURE.md:60-62`, `expressions.test.js:102-107`) describe a mask/value split that the
  pipeline stopped using when the star path became NB-to-RGB. A reader trusting them will assume
  the star colour still depends on the starless masks. The parameter is also a live footgun: it is
  the only thing standing between a future caller and masks built from a star field.
- **Fix:** decide which it is. Either collapse the signature to `fxBuildExpressions( p, ctx )` and
  update the architecture note and the test to say the split was retired with the NB-to-RGB star
  path, or keep the parameter and add one line to `ARCHITECTURE.md` recording that no current caller
  uses it. Leaving it as-is means the documentation is describing a dead code path as load-bearing.

#### M4. Emitted expressions re-expand every operand textually; green reaches 2116 characters with 20 copies of the Oiii sub-expression

- **Location:** `pjsr/lib/FXExpressions.js:253-263` (`hoBase`, `fxDynamicFactor`, `fxBlendByMask`),
  compounded by `fxMTF:123-124` and `fxGain:154-156`, both of which name `expr` twice; emitted
  through `fxPixelMathNew` / `fxPixelMathInPlace`, which set `P.symbols = ""`
  (`FXProcessing.js:519`, `FXProcessing.js:555`).
- **Evidence:** with the conditioning stage on (`sii {c0:0.02,m:0.31}`, `ha {c0:0.03,m:0.5}`,
  `oiii {c0:0.01,m:0.19}`) and gains 1.2/1.1/1.3, driving the bundle gives

  ```
  r len 1648   g len 2116   b len 303
  occurrences of Ha in g: 10   occurrences of Oiii in g: 20
  ```

  The multiplication chain is exact and checkable: `fxStretch` emits the shadow clip once, `fxMTF`
  doubles it, `fxGain` doubles it again (Oiii → 4 copies); `hoBase` holds one of each; the
  `base^~base` form doubles `hoBase`; `fxBlendByMask` names the mask twice more. 4 × 2 × 2 = 16
  copies of Oiii from the mask alone, plus 4 from the value term.
- **Why it matters:** a maintainability hazard first — a 2 KB single-line expression is
  unreviewable, and a mistake in one of the twenty copies would be invisible. The performance side
  is uncertain rather than proven: `P.optimization = true` is set, and PixInsight's expression
  optimiser may fold repeated subtrees, but nothing in this codebase establishes that it does, and
  the file's own numeric-emission section is written on the principle of not assuming PixelMath
  behaviour that has not been confirmed. `fxBuildHDRCompression` already demonstrates the
  alternative in this very file: a symbol list plus assignments.
- **Fix:** bind the shared factors with PixelMath symbols the way the HDR stage does — declare
  `o` and `ho` (and, when conditioning is on, the three prepared channels) in `P.symbols`, emit
  the assignments once, and reference the names in R/G/B. Gate it so that the default path still
  emits the published strings unchanged, because the bit-for-bit promise is made of strings.

### Low

#### L1. `fxSolveMTF` warns when it hits the lower clamp and is silent when it hits the upper one

- **Location:** `pjsr/lib/FXProcessing.js:118-148`.
- **Evidence:** the function warns for `m < FX_MTF_MIN` with a three-line explanation, then
  `return fxClamp( m, FX_MTF_MIN, 0.999 )`. The upper bound has no message. Driving the bundle:

  ```
  x=0.9  target=0.001  m=0.999000  actual=0.008929  ratio=8.93x
  x=0.97 target=0.03   m=0.999000  actual=0.031351  ratio=1.05x
  x=0.8  target=0.004  m=0.998997  actual=0.004000  ratio=1.00x
  ```

  The clamp becomes active around `x ≳ 0.8` when the target is at or near `fxChannelTransform`'s
  `0.001` floor — reachable with a bright channel and a dim reference (`target = referenceMedian ×
  boost`, boost floor `FXRanges.normOiii[0] = 0.20`).
- **Why it matters:** the channel silently misses its target by up to an order of magnitude, in the
  brightening direction, and the user is told nothing — while the symmetric failure at the other end
  produces a paragraph in the console. Both are "this channel will not land where you asked".
- **Fix:** mirror the existing warning on the `m > 0.999` side, naming the channel and the target it
  could not reach.

#### L2. Channels the palette does not use are still conditioned, and can raise a console warning naming an image the render will not touch

- **Location:** `pjsr/lib/FXProcessing.js:1441-1447` (`fxCollectStretch` passes `p.siiView`
  unconditionally) and `FXProcessing.js:366-370` (`fxStretchMapFor` calls `fxChannelTransform` for
  all three), against `fxCollectIds:1362-1381`, which nulls `sii` whenever
  `!fxStyle( p ).needsSii`.
- **Evidence:** with the fixed HOO palette selected, normalization on, defaults, and a flat Sii view
  still selected from an earlier session, driving the bundle gives

  ```
  map = {"sii":null,"ha":{"c0":0.0525,"m":0.5},"oiii":{"c0":0.01625,"m":0.2364...}}
  warnings: ["Channel normalization: SY has no signal above its black point (median 8.000e-2,
             black point 8.000e-2). This channel is left as it is. Lower \"Shadow point\" ..."]
  ```

  `fxPrepareChannels` returns `null` for a channel whose `id` is `null` before it ever consults
  `ctx.stretch`, so `map.sii` is correctly harmless — but the measurement, and the warning, happen
  anyway.
- **Why it matters:** the user is told to lower "Shadow point" because of an image that plays no part
  in the render, on every preview refresh. It also spends a median/MAD pass on an unused channel.
  The good news, verified: the *expression* side is safe — a stale Sii view cannot leak into a
  two-channel palette, because `fxCollectIds` gates it and both the final render and
  `FXPreview.js:518-519` go through it.
- **Fix:** have `fxStretchMapFor` skip a channel whose identifier the palette will not use — pass
  `fxStyle( p ).needsSii ? siiView : null`, mirroring `fxCollectIds`.

#### L3. Two guards in emitted expressions can never fire, and both are "covered" by assertions that cannot fail

- **Location:** `pjsr/lib/FXExpressions.js:402` and `pjsr/lib/FXExpressions.js:423-426`; tests at
  `tests/expressions.test.js:240-241` and `tests/expressions.test.js:254-257`.
- **Evidence:** (a) HDR — `s = iif(hi, iif(Y <= 0.0000000001, 1, Yc/Y), 1);` with
  `hi = Y > k` and `k = min( 0.99, max( 0.10, p.hdrKnee ) )` at line 383. The inner branch is
  entered only when `Y > k ≥ 0.10`, so the `Y <= 1e-10` test is unreachable. The test that claims
  to pin it is `ok( /Y <= 0\.0+1/.test( e.expression ) || e.expression.indexOf( 'iif(' ) >= 0 )` —
  the right-hand disjunct is satisfied by the outer `iif` alone, so deleting the guard entirely
  leaves the test green. (b) Luminance apply — `k = min( target/max(y0,EPS), headroom )` with
  `headroom = 1/max(max(max($T[0],$T[1]),$T[2]), EPS)`, so `k·$T[i] ≤ $T[i]/max(RGB) ≤ 1` for any
  non-negative channel, and PixelMath already writes the source with `truncate=true,
  truncateLower=0`. The wrapping `min(1, ...)` can never bind; `expressions.test.js:254` asserts its
  textual presence as "the expression clips at 1".
- **Why it matters:** minor on its own, but both are places where a reader (and the suite) believe a
  division or an overflow is being defended against when the arithmetic already rules it out. That
  invites someone to "simplify" the real constraint — the `k` floor of 0.10, or the `headroom`
  term — believing the visible clamp is what is holding the line.
- **Fix:** either drop the dead inner `iif` and the dead `min(1, ...)` with a comment recording why
  they are not needed, or keep them and change the two assertions to test the constraint that
  actually matters (`hdrKnee` is floored at 0.10; `k` never exceeds `headroom`).

#### L4. "k < 1 makes the transition earlier and softer" is backwards near black

- **Location:** `pjsr/lib/FXExpressions.js:39-46`; range `FXRanges.hardO = [0.05, 4.00]`
  (`FXParameters.js:537`).
- **Evidence:** the mask is `O^(k(1−O))`, whose derivative near 0 is `k·O^(k−1)`, which *diverges*
  as `O → 0⁺` for every `k < 1` and *vanishes* for every `k > 1`. Tabulating the emitted mask:

  ```
  O\k       0.05   0.25   0.65      1    1.8      4
  0.0001  0.6310 0.1000 0.0025 0.0001 0.0000 0.0000
  0.01    0.7962 0.3199 0.0516 0.0105 0.0003 0.0000
  0.1     0.9016 0.5957 0.2600 0.1259 0.0240 0.0003
  0.5     0.9828 0.9170 0.7983 0.7071 0.5359 0.2500
  ```

  At the slider's own minimum the mask is already 0.63 at O = 1e-4 and 0.80 at O = 0.01: the whole
  shadow range is 60-80 % Sii, and the "transition" has collapsed into a near-step at exactly 0.
- **Why it matters:** the comment tells a maintainer, and by extension the tooltip writer, that
  lowering the hardness widens the crossover. It narrows it — it moves the entire crossover into the
  black point and leaves red as essentially plain Sii over the whole frame. The setting is not
  wrong (it is monotonic, continuous, and someone may well want that look), the description is.
- **Fix:** reword to something the maths supports: `k > 1` pushes the crossover towards the
  highlights and flattens the mask in the shadows; `k < 1` pulls it down into the black point, and
  below about 0.25 the mask is effectively saturated everywhere above the noise floor.

### Nit

#### N1. `fxGain` rounds two literals independently, where `fxStretch` and `fxMTF` deliberately reuse one

- **Location:** `pjsr/lib/FXExpressions.js:147-157`, against the rule stated at
  `FXExpressions.js:135-137` and implemented at `FXExpressions.js:108-124`.
- **Evidence:** the numerator carries `fxNum(g)` and the denominator `fxNum(g−1)`, two separately
  rounded values, so `1 + (g−1)` need not reproduce `g`. Scanning the 281 reachable slider
  positions (0.20…3.00 in steps of 0.01) under a float32 model: **64 of 281 do not map a sample of
  exactly 1 to exactly 1**, worst deviation 1.19e-7 (`g = 0.20 → 1.0000001`). `fxStretch`'s comment
  is explicit that this is the failure mode it is avoiding: *"The same rounded literal has to
  appear in both places, otherwise (1 − round(c0)) and round(1 − c0) differ in the last digit and a
  sample of exactly 1 leaves the [0,1] range."*
- **Why it matters:** nothing in practice — `truncate = true, truncateUpper = 1` clips it, and 1e-7
  is below the 32-bit float resolution at 1.0. It is listed because the file states the rule and
  then breaks it three functions later.
- **Fix:** emit the denominator from the same literal, e.g. `((A*(x))/(1 + (A - 1.000000)*(x)))`
  with `A = fxNum(g)` — or record in a comment that the gain is exempt because its output is
  truncated anyway.

#### N2. "a sample of 1 maps to precisely 1" is not true of `fxMTF` in general

- **Location:** `pjsr/lib/FXExpressions.js:110-114`.
- **Evidence:** the two-literal form is `A·t / (B + (A − B)·t)`, and `B + (A − B)` equals `A` only
  when the intermediate rounds favourably. Scanning `m = 0.001…0.999`: **230 of 999 values fail in
  float32 and 233 of 999 in float64**. Worst case `m = 0.998`:
  `((0.002000*(T))/(0.998000 + (0.002000 - 0.998000)*(T)))` → `t = 1` gives `1.0000129` in float32
  (deviation 1.29e-5), from the cancellation of two near-1 values down to 0.002. `m` near 0.999 is
  reachable: it is exactly `fxSolveMTF`'s upper clamp (see L1). `emission.test.js:96` pins this at
  `1e-12` but samples only `m ∈ {0.25, 0.1, 0.01, 1e-3, 1e-5, 1e-7}`, which happen to round exactly;
  the float64 failures sit at ~1e-15, under its tolerance.
- **Why it matters:** practically nil (truncate clips, and 1.3e-5 is invisible in a 32-bit render).
  It is worth recording because the sentence is stated as a property, and someone may lean on it.
- **Fix:** soften the comment to "so a sample of 1 maps to 1 to within a rounding step, rather than
  to a value that can drift meaningfully past it", and, if it is worth pinning, extend
  `emission.test.js` to sweep `m` rather than sample six favourable values.

#### N3. Six clamps that cannot bind

- **Location and evidence:**
  - `FXExpressions.js:151` — `if ( g <= 0 ) return "0";` — `FXRanges.gainSii/gainHa/gainOiii` all
    start at 0.20 and `fxSanitize` clamps to the range.
  - `FXExpressions.js:120` — `m = Math.min( 0.999, Math.max( FX_MTF_MIN, m ) )` — the only
    production source of `m` is `fxSolveMTF`, which already returns `fxClamp( m, FX_MTF_MIN, 0.999 )`.
  - `FXExpressions.js:399` — `m1 = min(4, max(1, 1 + 3*a))` — `a` has already been through
    `fxClamp01`, so `1 + 3a ∈ [1, 4]`.
  - `FXExpressions.js:401` — `min(1, max(0, f))` — `f` is monotonic on [0,1] with `f(0)=0, f(1)=1`
    for every `m1 ∈ [1,4]`.
  - `FXProcessing.js:441` — `fxScaleDeltaCurve`'s `fxClamp(..., -1.0, 1.0)` — the largest magnitude
    in `FX_SATURATION_HS` is 0.15455 and `FXRanges.satStrength` ends at 2.00, so the clamp needs
    `k ≥ 6.47`. `normalization.test.js:240` only reaches it with synthetic deltas.
  - `FXProcessing.js:263` — `(c0 < 1)` — `fxBlackPointFor` clamps `c0` to 0.999.
- **Why it matters:** defensive clamps are fine, but a reader cannot tell which of these is load-
  bearing and which is decoration, and `fxMTF`'s in particular duplicates a floor the file's own
  comment (`FXExpressions.js:67-73`) explains as living in one place.
- **Fix:** no code change needed; a short "unreachable given <range>, kept as a belt" on each would
  do, and the `fxMTF` re-clamp could simply go.

#### N4. Two different neutrality thresholds

- **Location:** `FXExpressions.js:95-103` (`fxIsOne`/`fxIsZero`, 1e-5) versus `FXExpressions.js:182-185`
  (`fxMix`, 0.9999 / 0.0001 inline).
- **Evidence:** `fxMix` does not use the helpers that exist two functions above it, and uses a
  threshold ten times looser. Both are far below the 0.01 slider granularity so the identity
  branches are reached identically; this is purely an inconsistency.
- **Fix:** `if ( fxIsOne( t ) ) return aExpr; if ( fxIsZero( t ) ) return bExpr;`.

#### N5. `fxClamp01` duplicates `fxClamp`

- **Location:** `FXExpressions.js:332-335` versus `FXProcessing.js:38-41`.
- **Evidence:** identical semantics, `fxClamp01(v) === fxClamp(v, 0, 1)`. Both are in the same
  bundle. (The duplication is not an include-order necessity: `fxClamp01`'s two callers run at
  render time, long after `FXProcessing.js` has loaded.)
- **Fix:** keep one. If `FXExpressions.js` should not depend on `FXProcessing.js`, move `fxClamp`
  up into `FXExpressions.js` and have `FXProcessing.js` use it.

#### N6. The star red term hardcodes `0.5` while green goes through `fxNum`

- **Location:** `FXExpressions.js:324-325`.
- **Evidence:** `r: "0.5*(" + v.H + ") + 0.5*(" + red + ")"` next to
  `g: fxNum( r ) + "*(" + v.H + ") + " + fxNum( 1 - r ) + "*(" + v.O + ")"`. Pinned as-is by
  `expressions.test.js:153-154`, so the strings are deliberate — but the two halves of the same
  published combination are written by two different mechanisms.
- **Fix:** cosmetic only; if the 0.5/0.5 split ever becomes a constant, it should follow the
  `FX_STAR_HA_TO_OIII` pattern.

#### N7. `fxStretchMapFor` re-tests a condition it has already returned on

- **Location:** `FXProcessing.js:330-345`.
- **Evidence:** the function opens with `if ( !p.normalizeEnabled ) return null;` and then wraps
  its whole body in `if ( p.normalizeEnabled ) { ... }`, which is unconditionally true at that
  point; `referenceMedian` is hoisted outside the block for no reason.
- **Fix:** drop the inner `if` and its indentation level.

#### N8. `fxNum`'s precision cliff sits just above the band where it matters

- **Location:** `FXExpressions.js:77-93`.
- **Evidence:** the comment promises "a fixed number of decimals deep enough to keep four
  significant figures down to FX_MTF_MIN", but the deep branch is entered only below 1e-4. Just
  above the boundary six decimals give three: `fxNum(1.234567e-4) = "0.000123"`, a relative error
  of 0.37 %. Below the boundary, `fxNum(9.99e-5) = "0.000099900000"` — twelve. The precision is
  therefore discontinuous, and worst exactly where the deep branch was introduced to help. The
  practical error at `m ≈ 1e-4` is a sub-percent shift in a channel's background, well below
  visibility, and moving the boundary is not free: six decimals is what reproduces the original
  script's literals, which is the bit-for-bit constraint.
- **Fix:** none required; note in the comment that the four-significant-figure guarantee applies
  below 1e-4 and that the 1e-4…1e-3 band carries three, deliberately, to preserve the original's
  literals.

---

## Verification

Each finding was attacked before being kept. Outcomes:

- **H1 — CONFIRMED.** Tried to refute three ways. (a) Does a style reset it? No: no entry in
  `FXStyles` names `starStretch`, so `fxApplyStyle` leaves it alone. (b) Does `fxSanitize` normalise
  it? No — it only clamps against `FXRanges.starStretch = [0, 8]`, and 1.00 is inside. (c) Is the
  documentation stale rather than the code? Three independent places say 0 (`README.md:167`,
  `README.md:517`, `CHANGELOG.md:102`) plus the source comment at `FXProcessing.js:846-853`, and the
  sibling slider `starSaturation` is correctly at 0.00 — so 1.00 is the outlier, not the docs.
  Confirmed empirically that the value produces a real transform (`3^1.00` form, 0.05 → 0.136).
  Scope narrowed during verification: the starless image and the bit-for-bit invariant are *not*
  affected, only `_stars` and `_combined`. Severity kept at High on that narrowed scope.
- **M1 — CONFIRMED.** Refutation attempt: is the caller's `if ( p.hdrEnabled )` sufficient? For
  today's behaviour, yes — which is why this is Medium and not High. The finding is that the test
  claims coverage it does not provide; verified by executing
  `fxBuildHDRCompression( { hdrEnabled:false, hdrAmount:0.5 } )` and getting a non-null expression.
- **M2 — CONFIRMED.** `grep -rn "madn" pjsr/` over the whole source tree returns only the seven
  lines inside `fxChannelStats`. Checked that the tests' `fxTestView(..., {madn: ...})` stats are
  fixtures only. The header's claim was checked line by line against `fxBlackPointFor` and
  `fxChannelTransform`; MAD is absent from both.
- **M3 — CONFIRMED.** `grep` over `pjsr/` gives one production call site, `FXProcessing.js:1225`,
  passing `maskCtx` twice. Checked the preview separately: `FXPreview.js:626` calls `fxRenderParts`,
  the same function, so it does not introduce a second shape. Downgraded from an initial "the star
  path could leak the wrong masks" to a documentation/dead-parameter finding, because the star path
  demonstrably does not use this function at all.
- **M4 — CONFIRMED, with the performance half explicitly held back.** Character counts and operand
  occurrences measured, not estimated (2116 / 20 / 10), and the duplication factor re-derived by
  hand to match. The claim that PixelMath will re-evaluate the duplicates is *not* asserted:
  `P.optimization = true` is set and PixInsight may fold repeated subtrees. The finding is written
  as a maintainability hazard with an unproven performance component.
- **L1 — CONFIRMED but downgraded.** Initially drafted as Medium. Refutation: how reachable is the
  0.999 clamp? Solving `x(1−y)/(x+y−2xy) = 0.999` shows it needs a post-black-point median around
  0.8-0.97 against a target at or near the `0.001` floor — a bright channel with a dim reference.
  Real but uncommon, and the 8.9x miss is the worst corner rather than the typical one. Kept at Low,
  framed as the asymmetry (one clamp shouts, the other is mute) rather than as a numerical fault.
- **L2 — CONFIRMED, and half of it REFUTED.** The original suspicion was larger: that a stale Sii
  view could leak into a two-channel palette's red channel via
  `o = (m.S != null && v.S != null) ? ... : null` at `FXExpressions.js:255`. **Refuted:**
  `fxCollectIds:1362-1381` sets `sii: needsSii ? ... : null` and is the sole source of identifiers
  for both the final render (`fxRenderFinal:1476`) and the preview (`FXPreview.js:518-519`), so
  `m.S` and `v.S` are always null for a `needsSii: false` palette and the expression cannot name a
  channel the user did not give — which `expressions.test.js:92-99` also pins. What survives is only
  the conditioning stage, which does *not* go through `fxCollectIds`: reproduced the spurious
  warning empirically.
- **L3 — CONFIRMED.** Reachability of the HDR guard traced through `hi = Y > k` with `k` floored at
  0.10 by `Math.max( 0.10, p.hdrKnee )` on line 383 — no path reaches the inner branch. The
  luminance bound was verified algebraically (`k ≤ headroom = 1/max(RGB)` ⟹ `k·$T[i] ≤ 1`) and the
  non-negativity precondition checked: the source image is written by PixelMath with
  `truncateLower = 0`. Also verified that deleting the inner `iif` leaves
  `expressions.test.js:240` green.
- **L4 — CONFIRMED.** Derivative argument (`d/dO O^k = k·O^(k−1)`, divergent at 0 for `k<1`) checked
  against a numerically tabulated mask over the full slider range. Refutation attempt: is
  "softer" meant of the mid-tone crossover rather than the black end? Even there the table shows
  `k = 0.05` reaching 0.90 by O = 0.1 — the crossover is not widened anywhere, it is displaced
  downwards. Kept, but as a comment-accuracy finding, not a behavioural one.
- **N1 — CONFIRMED.** Scanned all 281 reachable gain positions under `Math.fround`, mirroring the
  emitted literals; 64 fail, worst 1.19e-7. Materiality checked and found nil (`truncate = true`),
  hence Nit.
- **N2 — CONFIRMED, and it corrected my first reading.** I initially sampled eight `m` values, all
  of which came out exact, and was about to record "no finding". Sweeping the full grid instead
  found 230/999 float32 and 233/999 float64 failures, with the worst case (1.29e-5 at m = 0.998)
  caused by cancellation — and `m` near 0.999 is exactly where `fxSolveMTF` clamps. Also verified
  that `emission.test.js:96` cannot catch it: its six sampled `m` values round exactly, and the
  float64 residuals are ~1e-15, under its 1e-12 tolerance.
- **N3 — CONFIRMED.** Each of the six checked against its actual range or its caller, individually.
- **N4, N5, N6, N7 — CONFIRMED** by direct reading; all cosmetic.
- **N8 — CONFIRMED but deliberately left as a Nit.** Refutation partly succeeded: the six-decimal
  branch is not an oversight, it is what reproduces the original script's literals and therefore
  part of the bit-for-bit constraint, so the boundary should *not* move. Only the comment's
  four-significant-figure phrasing overstates what happens in the 1e-4…1e-3 band.

Findings considered and **REFUTED** outright, recorded here so they are not re-raised:

- **A stale Sii view leaking into a two-channel palette's red channel.** Refuted — see L2 above.
  `fxCollectIds` gates it for both the render and the preview.
- **`ho` built without a null check on `m.H` / `m.O` (`FXExpressions.js:253`), unlike `o`.**
  Refuted as a live fault: `fxValidate:1069-1070` requires Ha and Oiii for every style
  unconditionally, and `fxCollectIds` never nulls them. The asymmetry with `o` is intentional —
  only Sii is optional.
- **Non-monotonic curves at `curveStrength = 2`.** Refuted. Computed `fxScaleCurve` at k = 2 for
  `FX_CURVE1_H` (0, 0.0939, 0.0982, 0.1618, 0.7322, 1), `FX_CURVE2_H` (0, 0.0211, 0.1224, 0.2506, 1)
  and `FX_CURVE1_S` (0, 0.7253, 1) — all strictly increasing, and no point reaches the [0,1] clamp.
- **`fxMTF` denominator failing at `t = 1` in float32 for the values the pipeline uses.** Partly
  refuted, partly kept: the eight most obvious `m` values are exact (which is why it is N2 and not
  higher), and the residual error is invisible under truncation.
- **`fxSolveMTF` inverting `fxMTFValue` incorrectly.** Refuted. Derived
  `m = x(1−y)/(x + y − 2xy)` independently and matched it to line 141; `fxMTFValue`'s
  `((m−1)x)/(((2m−1)x) − m)` is the standard MTF with numerator and denominator both negated.
  `normalization.test.js:28-33` already round-trips it.
- **`~0.01` being the wrong inverse for `mtf(0.01, ·)` in the star finishing chain.** Refuted:
  `MTF(1−m, MTF(m, x)) = x` exactly, so `~0.01 = 0.99` is the correct undo.
- **The HDR Hermite expanding rather than compressing highlights.** Refuted:
  `f(t) − t = (m₁−1)·t²(t−1) ≤ 0` on [0,1] for `m₁ ≥ 1`, so tones move down towards the knee. The
  cap at 4 is exactly the monotonicity limit, as the comment says.
- **A discontinuity at the HDR knee.** Refuted: as `Y → k⁺`, `t → 0`, `f → 0`, `Yc → k`, `s → 1`,
  matching the `s = 1` branch below the knee.
- **Posterisation emitting a divide-by-zero or an off-by-one level count.** Refuted:
  `n = max(2, round(levels)) − 1 ≥ 1` always, and `floor(x·n + 0.5)/n` yields exactly `n+1 = levels`
  evenly spaced values including 0 and 1.
- **`fxStretch` dividing by zero at `c0 = 1`.** Refuted: `fxBlackPointFor` clamps to 0.999, so
  `1 − c ≥ 0.001`, and the same rounded literal appears on both sides as the comment requires.
- **`fxNum` emitting exponential notation or `nan`.** Refuted for every reachable input:
  `toFixed`/`%.6f` are fixed-notation, `emission.test.js:16-24` sweeps the magnitudes, and the one
  path that could deliver a NaN (`fxChannelStats`) intercepts it at `FXProcessing.js:166-173`.
- **Operator-precedence faults in any emitted string.** Refuted by inspection of every composition
  point: `fxMTF`, `fxGain` and `fxMix` all wrap their whole result; `fxDynamicFactor`,
  `fxBlendByMask` and `fxBuildCombineExpression` parenthesise every operand of `^`, `~` and `*`;
  and the two builders that return an unwrapped top-level sum (`fxBlendByMask`,
  `fxBuildStarRGBExpressions`) are either wrapped by their caller or handed straight to PixelMath as
  a complete expression.
