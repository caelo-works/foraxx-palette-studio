# Reinstating linear input support

Design specification and implementation plan.
Written against `main @ 64591ce`. Every code claim below was read out of the tree
at that commit; every number was produced by driving `tests/build/module.js`.

**Reference data.** Six linear Float32 Gray XISF masters, 3764 × 2101, in
`testset/` (gitignored). All statistics in this document are **exact full-frame**
values — 7 908 164 pixels each, median and MAD computed over every pixel, not
sampled.

| view | median | MADN | avgDev | min | max | p0.1 | p1 | p99 | p99.9 | MADN/median |
|---|---|---|---|---|---|---|---|---|---|---|
| `S` | 3.291e-3 | 2.928e-4 | 3.894e-4 | 2.292e-3 | 4.464e-2 | 2.646e-3 | 2.791e-3 | 6.836e-3 | 9.872e-3 | 0.089 |
| `H` | 7.062e-3 | 1.976e-3 | 3.856e-3 | 3.663e-3 | 2.505e-1 | 4.655e-3 | 5.146e-3 | 5.644e-2 | 7.933e-2 | 0.280 |
| `O` | 5.717e-3 | 2.342e-4 | 3.992e-4 | 4.733e-3 | 2.670e-2 | 5.116e-3 | 5.259e-3 | 1.107e-2 | 1.529e-2 | 0.041 |
| `S_stars` | 8.596e-6 | 1.069e-5 | 4.872e-4 | 1.329e-7 | 9.970e-1 | 2.864e-7 | 4.317e-7 | 4.967e-3 | 6.933e-2 | 1.244 |
| `H_stars` | 3.210e-6 | 3.432e-6 | 4.286e-4 | 0.000e+0 | 9.945e-1 | 3.753e-7 | 5.234e-7 | 4.447e-3 | 6.150e-2 | 1.069 |
| `O_stars` | 2.474e-6 | 2.853e-6 | 3.113e-4 | 0.000e+0 | 9.944e-1 | 2.077e-7 | 2.664e-7 | 2.809e-3 | 4.352e-2 | 1.153 |

Three things in that table drive the whole design.

1. The nebula channels carry a **pedestal**: each minimum is 30–85 % of its own
   median. There is no zero in this data. A design that assumes a pedestal-free
   background is designing for different data.
2. `H`'s MADN is **6.7×** `S`'s and **8.4×** `O`'s, and 28 % of its own median.
   That is not more noise, it is more nebula: MADN on a signal-filled frame is
   inflated by the signal. Any black point expressed in MADN is therefore
   *signal-dependent*, and on `H` it lands **below the frame minimum**.
3. The star frames sit **2200–2900× below** the nebula channels and their MADN
   exceeds their median. They are empty sky with a sparse population of peaks —
   exactly the 2.6.1 trap, in the data.

`fxLooksLinear` sees medians of 3.29e-3 / 7.06e-3 / 5.72e-3, all under its 0.02
threshold, and correctly calls this set linear.

---

## 1. Root cause analysis

### The failure, reproduced on the reference set

`fxStretchMapFor` with Channel normalization on, reference Ha, shadow 0.25 —
i.e. the only conditioning HEAD has:

| ch | c0 | m | median lands at |
|---|---|---|---|
| `S` | 2.542e-3 | 2.2653e-1 | **0.00256** |
| `H` | 4.513e-3 | 5.0000e-1 | **0.00256** |
| `O` | 4.979e-3 | 2.2425e-1 | **0.00256** |

And the finished *Foraxx — classic* image, built by evaluating the emitted
PixelMath strings over 400 000 real pixels (`fxBuildExpressions`, then
`~(~a*~b)` against the star image):

| image | ch | p1 | median | p95 | p99 | p99.9 | max |
|---|---|---|---|---|---|---|---|
| starless | R | 0.0051 | **0.0071** | 0.0243 | 0.0555 | 0.0779 | 0.1909 |
| starless | G | 0.0053 | **0.0057** | 0.0073 | 0.0110 | 0.0155 | 0.0253 |
| starless | B | 0.0053 | **0.0057** | 0.0073 | 0.0110 | 0.0154 | 0.0247 |
| combined | G | 0.0053 | 0.0057 | 0.0080 | 0.0124 | 0.0488 | 0.9815 |

Black, with white stars punched through it. This is the bug report, on real data.

One correction to the received account, because it matters for the test plan:
on **this** set the 0.001 clamp in `fxChannelTransform` never fires. The
reference median after its black point is 2.561e-3, above 0.001, so the target
is simply *the reference channel's own linear median*. The clamp is a symptom of
one particular depth of data, not the disease. **The disease is that the target
is relative.** Data with the pedestal removed (background ~3e-5, as in
`tests/normalization.test.js`) does hit the clamp; this set does not; both come
out black. Say "relative target", not "0.001 clamp", in the code comments.

### The five historical faults, one by one

| # | Version | Fault | Fixed in HEAD? | Load-bearing for linear? |
|---|---|---|---|---|
| a | 2.3.4 | `fxNum` could only emit six decimals; a balance of 2.5e-5 kept two significant figures, one of 3e-6 kept none | **Yes**, `FXExpressions.js:74-93` — `FX_NUM_DECIMALS = 12` and `fxNum` switches to `toFixed(12)` for `0 < |v| < 1e-4`. `FX_MTF_MIN` is `1.0e-8` (line 75), and `fxSolveMTF` clamps to the same floor (`FXProcessing.js:130,139`) | **Yes, conditionally** — see below |
| b | 2.3.4 | With normalization also on, the target came from the reference's raw linear median | **No — this is the open fault.** `FXProcessing.js:303`: `target = fxClamp( referenceMedian * boost, 0.001, 0.999 )`. There is no absolute target anywhere in the tree | **This is the work** |
| c | 2.3.5 | Preview averaged star channels before a 243× stretch | **Yes**, `FXPreview.js:470-505` — `makeChannel(..., peaks)` sets `IntegerResample.prototype.Maximum` and reports whether it was honoured; `FXDialog.js:352-358` warns when it was not | **Yes** — and it acquires a *new* side effect under linear input, see §6 R4 |
| d | 2.4.0 | Star brightness stretch applied unconditionally at 3^5 | **Yes**, optional and slider-driven. `fxBuildStarStretchExpression` returns `null` at k = 0 (`FXExpressions.js:307-315`). But the default is `starStretch: 1.00`, i.e. 3× — not 0 | **Partly** — the 243× blowout cannot return; a 3× double-stretch can. See §6 R3 |
| e | 2.6.1 | Star frames solved their own auto stretch | **Yes**, `fxCollectStretch` (`FXProcessing.js:1441-1470`) takes `map[key].m` from the nebula and recomputes `c0` per star frame. The rule survives; only the black-point *function* it calls needs to follow the new branch | **Yes, absolutely** |
| f | 2.7.0 | Level markers remembered across a source change | **Yes**, `FX_LEVEL_SETS` / `fxResetAllLevels` (`FXParameters.js:~345-390`) and `this.sourceChanged()` (`FXDialog.js:585-597`) reset all three sets and say so; `fxLevelsInForceElsewhere` names any set in force but off screen | **Yes** — and it needs one new trigger, §4 |

#### Is fault (a)'s fix actually load-bearing on this data?

No, and I want to be precise about that rather than repeat the folklore.

The solved balance is, for a small post-black-point median `xm` and target `T`,
`m = xm(1−T) / (xm + T − 2·xm·T) ≈ xm·(1−T)/T`. At `T = 0.25` that is about
`3·xm`. `fxNum` switches to twelve decimals below `1e-4`, so the twelve-decimal
path is reached only when `xm < 3.33e-5`.

On the reference set, with the design of §2:

| ch | c0 | xm | m | `fxNum(m)` | decimals used |
|---|---|---|---|---|---|
| `S` | 2.4710e-3 | 8.199e-4 | 2.4618e-3 | `0.002462` | 6 |
| `H` | 3.6632e-3 | 3.4115e-3 | 1.0164e-2 | `0.010164` | 6 |
| `O` | 5.0614e-3 | 6.556e-4 | 1.9748e-3 | `0.001975` | 6 |

Every `m` is 20–100× above the `1e-4` switchover. **Six decimals would have been
enough here**, with four significant figures to spare. Fault (a) does not return
on this set.

It does return on pedestal-free data, which is common (a WBPP master with
pedestal subtraction sits at 1e-5 to 1e-4). Sweeping synthetic backgrounds with
MADN = median/4 and `T = 0.25`:

| background | m | six decimals | median lands at | error |
|---|---|---|---|---|
| 1e-3 | 2.0977e-3 | `0.002098` | 0.2500 | −0.0 % |
| 1e-4 | 2.0998e-4 | `0.000210` | 0.2500 | −0.0 % |
| 1e-5 | 2.1000e-5 | `0.000021` | 0.2500 | −0.0 % |
| 5e-6 | 1.0500e-5 | `0.000010` | 0.2593 | +3.7 % |
| 5e-7 | 1.5000e-6 | `0.000001` | 0.3333 | +33 % |
| 2e-7 | 6.0000e-7 | `0.000001` | 0.1667 | −33 % |
| 1e-7 | 3.0000e-7 | `0.000000` | **NaN** | total |

With twelve decimals every one of those rows lands on 0.2500. So: **the
twelve-decimal path is a genuine prerequisite, it is just not what is failing on
this particular reference set.** Keep it; assert it; do not claim it is the fix.

#### Summary of what is load-bearing

Four of the five fixes must hold for linear support and all four are present:
(a) deep emission, (c) peak-first preview downsampling, (e) shared star curve,
(f) level reset on source change. Fault (b) is unfixed and is the entire feature.
Fault (d) is fixed structurally but its default value is now wrong for the
linear path — a policy problem, not a code problem.

---

## 2. The design

### 2.1 Shape

Nothing moves. The expression layer already accepts a per-channel
`{ c0, m }` pair through `ctx.stretch` — `fxPrepareChannels` (`FXExpressions.js:196-213`)
calls `fxStretch( id, c0, m )` before `fxGain`, and `fxStretch` emits a shadows
clip plus a midtones transfer. That plumbing survived 3.0.0 intact. The only
thing missing is a producer that can put an **absolute** number in `m`.

So the change is confined to: where `fxChannelTransform` gets its target and its
black point, one new switch, two new numbers, and the UI around them.

### 2.2 The black point

```
c0 = clamp( max( median + sigma·MADN, minimum ), 0, 0.999 )
if c0 <= 1e-6: c0 = 0          // matches fxStretch's emission threshold
```

with `sigma` defaulting to **−2.80**.

**Where this follows PixInsight.** This is the ScreenTransferFunction
AutoStretch black point, sign convention and default value included: PI computes
`c0 = median + shadowsClipping·deviation` with `shadowsClipping = −2.80`, and the
`m` that follows is `MTF(targetBackground, median − c0)`. That identity is worth
stating because it is already implemented here: solving `MTF(m, x) = y` for `m`
gives `m = x(1−y)/(x + y − 2xy)`, which is algebraically `MTF(y, x)`.
`fxSolveMTF` (`FXProcessing.js:118-140`) computes exactly that expression. **The
solver in the tree is already PixInsight's auto-stretch formula.** No new maths
is required, only a new argument.

**Where this departs from PixInsight — two places, both deliberate.**

*Departure 1: MADN, not avgDev.* PI's STF uses the mean absolute deviation from
the median. This codebase already measures `MAD × 1.4826` (`fxChannelStats`,
`FXProcessing.js:174-192`) and there is no reason to add a second dispersion
statistic. On Gaussian noise `avgDev = 0.798σ` and `MADN = 1.000σ`, so
`−2.80·avgDev ≈ −2.23·MADN`: at the same nominal −2.80, a MADN-based clip is
about 25 % **shallower** than PI's, and therefore safer. On real data the gap is
larger still, because `avgDev` is far more sensitive to the star population —
look at the star frames in the header table, where `avgDev` is 100× the MADN.
Using MADN is the more robust choice and the more conservative one. Say so in
the tooltip.

*Departure 2: the black point is pinned at the frame minimum.* PI clamps to
[0, 1] only. That is not enough here, because `H` has enough nebulosity to
inflate its MADN past its own pedestal:

| ch | c0 unpinned | vs. minimum | m unpinned | frame minimum maps to | m pinned | pinned minimum maps to |
|---|---|---|---|---|---|---|
| `S` | 2.4710e-3 | +1.79e-4 above | 2.4618e-3 | 0.0000 | 2.4618e-3 | 0.0000 |
| `H` | 1.5301e-3 | **−2.13e-3 BELOW** | 1.6439e-2 | **0.1136** | 1.0164e-2 | 0.0000 |
| `O` | 5.0614e-3 | +3.28e-4 above | 1.9748e-3 | 0.0000 | 1.9748e-3 | 0.0000 |

Unpinned, `H` keeps a 0.11 grey floor that `S` and `O` do not. All three medians
still land on target, so the background stays neutral, but the darkest pixels do
not: `H` has 11 % of the range removed from its shadows. Pinning costs nothing
(it can only ever remove pedestal, never signal, since `minimum ≤ median` always)
and degrades gracefully: on a frame whose minimum is an outlier or a registration
zero — `H_stars` and `O_stars` both have `min = 0` exactly — the pin is inert and
you are back to PI's behaviour.

**Is −2.80 MADN safe on `S` and `O`, whose MADN is small relative to the median?**
Measured clipped-pixel fractions on the real frames:

| ch | σ = −1.00 | −1.50 | −2.00 | −2.25 | **−2.80** | −3.50 | −5.00 |
|---|---|---|---|---|---|---|---|
| `S` | 10.357 % | 2.242 % | 0.274 % | 0.077 % | **0.002 %** | 0.000 % | 0.000 % |
| `H` | 0.710 % | 0.003 % | 0.000 % | 0.000 % | **0.000 %** | 0.000 % | 0.000 % |
| `O` | 12.581 % | 3.922 % | 0.864 % | 0.356 % | **0.036 %** | 0.001 % | 0.000 % |

Yes: −2.80 clips 190 pixels of `S` and 2 800 of `O` out of 7.9 million. `S` and
`O` have *tight* distributions — their minima sit only 3.4 and 4.2 MADN below
their medians — so 2.8 MADN lands just above the floor by construction. The
danger zone is the other end: at −1.0 you would discard 10–13 % of both frames.
That sets the slider's usable range, and argues for keeping the default deep.

At −3.50 and beyond the pin starts binding on `S` and `O` too and the residual
floor reappears (`S` minimum → 0.0083 at −3.50, → 0.0956 at −5.00, unpinned).
With the pin, it does not. Another point for the pin.

**Star frames.** All three star frames' `median + (−2.8)·MADN` is negative
(`S_stars` −2.135e-5, `H_stars` −6.399e-6, `O_stars` −5.514e-6), pins to a
minimum of ~1e-7 or exactly 0, falls under the `1e-6` emission threshold and is
dropped to zero. That is the right answer: these frames have no pedestal to
remove, and 0.000–0.001 % of their pixels are affected. The star-frame black
point degenerates to "none", automatically.

### 2.3 The target

```
target(k) = linearTarget × (normalizeEnabled ? boost(k) : 1)
```

`linearTarget` default **0.25**, PI's `targetBackground`.

This is the whole answer to "where does the absolute target come from", and it
also answers "how does it interact with Channel normalization" — exactly, and in
closed form.

Channel normalization says *"put Oiii at 0.8× of the reference"*. The auto
stretch puts every channel, reference included, on `T` by construction.
Therefore the reference's post-stretch median **is** `T`, and normalization's
demand collapses to *"put Oiii at `0.8·T`"* — an absolute number. Two MTFs do not
compose into an MTF, but they do not need to: one MTF solved directly for
`T·boost` produces the identical result, because the only thing either stage
constrains is where the median lands.

Verified numerically (deep synthetic channels, S/H/O at 3e-5 / 5e-5 / 2e-5):

| boosts (S,H,O) | ch | target | median lands at | ratio to Ha |
|---|---|---|---|---|
| 1.0, 1.0, 1.0 | S | 0.2500 | 0.2500 | 1.000 |
| | H | 0.2500 | 0.2500 | 1.000 |
| | O | 0.2500 | 0.2500 | 1.000 |
| 1.2, 1.0, 0.8 | S | 0.3000 | 0.3000 | 1.200 |
| | H | 0.2500 | 0.2500 | 1.000 |
| | O | 0.2000 | 0.2000 | 0.800 |
| 0.5, 1.0, 1.5 | S | 0.1250 | 0.1250 | 0.500 |
| | H | 0.2500 | 0.2500 | 1.000 |
| | O | 0.3750 | 0.3750 | 1.500 |

Exact, to the last digit the expression can carry.

Three consequences the implementer must not miss.

- **The `[0.001, 0.999]` clamp becomes dead code on this path** and must stay
  dead. `linearTarget ≥ 0.02` and `boost ≥ 0.20` give a floor of 0.004, four
  times the clamp. Keep the clamp for the normalization-only path, where it is
  still doing its job; do not let it near the absolute path.
- **The "Reference:" combo goes inert** when the auto stretch is on. Every
  channel is placed on an absolute number; there is no reference median left to
  be relative to. What survives of the reference idea is "whichever level slider
  you leave at 1.00". Grey the control and say why.
- **"Shadow point" goes inert too.** It is a second black-point convention
  (`minimum + normShadow·(median − minimum)`, `fxBlackPointFor`,
  `FXProcessing.js:236-254`) and cannot coexist with the sigma clip in a single
  `c0`. Grey it. The normalization section keeps only its three level
  multipliers, which is exactly the part that still means something.

**Should the target be per channel?** No. It already is, through the boosts.
Adding a second per-channel target would give two controls for one number. One
absolute target sets the common background; the three existing boosts express
every deviation from it. On the reference set this is visibly the right split:
after the stretch, `H` reaches p99 = 0.777 where `S` reaches 0.640 — that is `H`
genuinely having more dynamic range, not an imbalance to correct, and the boosts
leave it alone.

**Is 0.25 the right default?** Measured, on the real set, with the full
*Foraxx — classic* pipeline:

| target | m (S) | m (H) | m (O) | starless median R/G/B | combined median | combined p1 | combined p99 | starless p99 G |
|---|---|---|---|---|---|---|---|---|
| 0.05 | 1.539e-2 | 6.106e-2 | 1.238e-2 | 0.050/0.050/0.050 | 0.0518 | 0.0166 | 0.3832 | 0.3505 |
| 0.10 | 7.349e-3 | 2.989e-2 | 5.901e-3 | 0.100/0.100/0.100 | 0.1036 | 0.0347 | 0.5986 | 0.5643 |
| 0.15 | 4.640e-3 | 1.903e-2 | 3.724e-3 | 0.149/0.150/0.150 | 0.1554 | 0.0544 | 0.7220 | 0.6954 |
| 0.20 | 3.280e-3 | 1.351e-2 | 2.631e-3 | 0.198/0.201/0.200 | 0.2073 | 0.0758 | 0.7969 | 0.7749 |
| **0.25** | 2.462e-3 | 1.016e-2 | 1.975e-3 | **0.247/0.251/0.250** | 0.2590 | 0.1003 | 0.8459 | 0.8289 |
| 0.35 | 1.525e-3 | 6.317e-3 | 1.223e-3 | 0.344/0.352/0.350 | 0.3614 | 0.1565 | 0.9070 | 0.8928 |

Every row lands on its target within 0.002 and produces a neutral background
(R/G/B within 0.004 of each other at every target). Ship **0.25**: it is PI's
number, it is what the 2.x code aimed at, and a user who has ever pressed the STF
button knows what it will look like. Say plainly in the tooltip that 0.10–0.15
is what most people will want for a finished image, and that the levels histogram
directly below is where to take it down. Do not make the darker value the
default on a hunch; make it one slider move away.

### 2.4 Star frames — verifying the 2.6.1 reasoning still holds

The rule from 2.6.1 is: star frames take the **nebula's midtones balance** and
their **own black point**. It is implemented in `fxCollectStretch`
(`FXProcessing.js:1441-1470`) and it survives 3.0.0 untouched. It needs one edit —
the `c0` it recomputes must come from the new sigma clip rather than
`fxBlackPointFor` — and nothing else.

Measured on the real star frames, sharing `m = 1.0164e-2` from `H`:

| star frame | own c0 | void bg (median) → | 1e-3 → | 1e-2 → | 0.1 → | 0.5 → |
|---|---|---|---|---|---|---|
| `H_stars` | 0 (pinned, dropped) | **0.0003** | 0.0564 | 0.3764 | 0.8691 | 0.9835 |

Dark void, graded stars, cores near but not at white. Now the same frames solved
their **own** stretch to 0.25 — the 2.6.1 bug, reproduced:

| | void bg | 1e-3 | 1e-2 | 0.1 | 0.5 |
|---|---|---|---|---|---|
| own stretch | **0.2500** | ≥ 0.99 | ≥ 0.99 | ≥ 0.99 | ≥ 0.99 |

And through the full pipeline over 400 000 real pixels, screen-combined:

| variant | image | ch | p1 | median | p95 | p99 | p99.9 |
|---|---|---|---|---|---|---|---|
| **shared curve, own c0** | stars | G | 0.0001 | 0.0010 | 0.0818 | 0.4721 | 0.9172 |
| | combined | G | 0.1003 | **0.2590** | 0.6552 | 0.8459 | 0.9588 |
| **own stretch (2.6.1)** | stars | G | 0.0514 | 0.2565 | 0.9681 | 0.9971 | 0.9998 |
| | combined | G | 0.2005 | **0.4625** | 0.9797 | 0.9984 | 0.9999 |

The combined background moves from 0.259 — the nebula's own level, untouched, as
it must be, since `~(~a·~b)` cannot go below the brighter input — to 0.463, with
p95 at 0.98. That is literally the changelog's "washed-out image sitting on a
grey floor", measured. **The 2.6.1 reasoning holds. Do not relitigate it.**

One refinement to the reasoning that the changelog does not state and that is
worth writing into the comment: a star frame curve *gentler* than the nebula's
would be safe with respect to 2.6.1 (a darker star image cannot lift the screen
combination), and only a *brighter* one is fatal. Sharing the curve exactly is
what keeps a star and a nebula pixel of the same flux at the same output level,
which is the reason to prefer it over merely-safe.

### 2.5 When a channel has no signal above its black point

With the pin at the frame minimum, `c0 ≤ median` always, so
`xm = (median − c0)/(1 − c0)` can only be zero when `median == minimum` (at
least half the frame sits on the floor) or `median == 0`. The current code's
response — return `null`, leave the channel linear (`FXProcessing.js:307-318`) —
is the worst possible answer under an auto stretch, because "linear" now means
"black, and the other two channels are not". Two-stage fallback:

```
xm = (median - c0)/(1 - c0)
if !(xm > 0):
    c0 = 0; xm = median                  // drop the clip, keep the curve
    if !(xm > 0):
        warningln( id + " has a median of zero. It is left as it is; the
                   result will be black in this channel." )
        return null
    warningln( id + ": the shadow clip has been dropped - the frame is flat or
               clipped at its median. The channel is still stretched." )
m = fxSolveMTF( xm, target )
```

Verified on degenerate inputs:

| case | c0 | m | median lands at |
|---|---|---|---|
| MADN from the `stdDev` fallback, huge | 0 | 4.500e-5 | 0.2500 |
| median ≤ minimum (already clipped) | 0 | 3.000e-5 | 0.2500 |
| sigma clip below zero | 0 | 3.000e-5 | 0.2500 |
| MADN = 0 (flat frame) | — | — | null + warning |
| median = 0 | — | — | null + warning |

The existing `stdDev` fallback in `fxChannelStats` (used when `MAD()` returns 0
or throws) is safe under this design: a huge dispersion drives `c0` negative, it
clamps to 0, and the curve still lands the median on target. It costs the black
point, not the image.

### 2.6 Switch, not detection

**An explicit checkbox, defaulting to off.** Not automatic on `fxLooksLinear`.

- The parity promise is that default output on non-linear data is unchanged.
  A stage that arms itself on a measured statistic makes the default output a
  function of the data, and `fxLooksLinear`'s 0.02 threshold is close enough to a
  dark hand-stretch to be tripped by one.
- 2.7.0's lesson is precisely that conditioning which depends on something not
  on screen produces bug reports nobody can diagnose.
- A user may deliberately feed a dark non-linear frame and want it left alone.

But the script should be loud in both directions, using detection to *offer* the
switch rather than to *throw* it:

- channels look linear and the switch is **off** → status line, in capitals, and
  it names the control by its exact label;
- the switch is **on** and the channels do **not** look linear → status line
  warning, because an STF on an already-stretched frame is destructive. Measured:
  a frame at median 0.15 / MADN 0.02 gets `c0 = 0.094`, `m = 0.165`, and 0.5
  comes out at 0.804 — the upper midtones are gone.

---

## 3. The UI

### New section

A `SectionBar` with a checkbox, titled **"Linear input"**, placed immediately
**above** "Channel normalization" in `this.leftSizer`. (3.0.0 left its stub
header *below* normalization — `git show 0de8eb6` — but above is the better
reading order now, because switching it on is what greys two of normalization's
controls.) Collapsed and unchecked by default, exactly like `normalizeBar`
(`FXDialog.js:727-747`).

| control | parameter | default | range | decimals |
|---|---|---|---|---|
| section checkbox — "Linear input" | `linearEnabled` | `false` | — | — |
| "Target background:" | `linearTarget` | `0.25` | 0.02 – 0.50 | 3 |
| "Shadow clipping:" | `linearShadow` | `-2.80` | −6.00 – 0.00 | 2 |

Both numeric rows built with the existing `fxNumericRow`, so they get their reset
buttons and their `FXRanges` entries for free.

**Section checkbox tooltip.**

> Stretches each channel before it is combined, so linear masters straight out of
> stacking can be used directly.
>
> Each channel gets a black point a fixed number of MADN below its own median,
> then a midtones curve that puts its median on the target background. This is
> PixInsight's own auto-stretch, the one behind the ScreenTransferFunction
> button, applied for real rather than for display.
>
> It is not a substitute for a considered stretch. It is one curve per channel and
> it compresses the highlights the way an STF does. If you already have stretched
> masters, leave this off and use them.

**"Target background" tooltip.**

> Where each channel's median lands. 0.25 is PixInsight's own auto-stretch
> target and is what the screen transfer function shows you.
>
> Most finished images want less: try 0.10 to 0.15 for a darker sky. You can also
> leave this at 0.25 and bring the background down with the black point on the
> histogram below.

**"Shadow clipping" tooltip.**

> How far below each channel's median the black point sits, in MADN.
>
> −2.80 is PixInsight's auto-stretch default and discards almost nothing —
> measured on linear narrowband masters it clips well under 0.1 % of the frame.
> Move it towards 0 to deepen the background, but watch the count: at −1.00 the
> same masters lose 10 % of their pixels.
>
> The black point is never placed below the channel's darkest pixel, so this can
> only ever remove a sky pedestal, never real signal.

### Controls that go inert

When `linearEnabled` is true, in `updateControls()`:

```
this.normRefRow.enabled    = FX.normalizeEnabled && !FX.linearEnabled;
this.normShadowRow.enabled = FX.normalizeEnabled && !FX.linearEnabled;
```

with a note appended to both tooltips: *"Set by the linear auto stretch while
Linear input is on."* The three level sliders stay live — they are the boosts,
and they multiply the absolute target.

### The header banner

Replace `FXDialog.js:373-381`:

```
"<b>" + TITLE + "</b> &nbsp; v" + VERSION + " &nbsp;&mdash;&nbsp; " +
"dynamic and classic narrowband palettes with a live preview, per-channel weighting, " +
"adjustable transitions and independent star and luminance control." +
"<br/>Bring stretched channels, or tick <b>Linear input</b> to auto-stretch linear " +
"masters as they are combined."
```

### The status line

In `updatePreviewStatus` (`FXDialog.js:329-364`), replace the current
`fxLooksLinear` clause:

```
if ( fxLooksLinear( FX ) && !FX.linearEnabled )
   note += "  -  THESE CHANNELS LOOK LINEAR. Tick \"Linear input\" to stretch them, "
         + "or stretch them yourself first.";
else if ( FX.linearEnabled && !fxLooksLinear( FX ) )
   note += "  -  \"Linear input\" is on but these channels are already stretched; "
         + "the auto stretch will flatten the highlights.";
else if ( FX.linearEnabled && FX.starStretch > 0 && FX.makeStars && FX.previewTarget == 1 )
   note += "  -  the star frames are already stretched by the auto stretch; "
         + "star brightness above 0 stretches them a second time";
```

Note the existing `hdrEnabled` branch on line 353 **assigns** to `note` rather
than appending, silently discarding everything above it. That is a pre-existing
bug; it will now swallow the linear warnings too. Fix it to `+=` in the same
change and pin it in a test.

### Documentation

The file header (`ForaxxPaletteStudio.js:13-21`), `#feature-info` (line ~253),
`README.md` lines 30-35, 83-93 and 467-468 all state that linear data is not
supported. Every one must change. The README's 3.0.0 section is history and stays
as written; the new version's entry says what changed and why it is believed to
hold this time, with the reference-set numbers.

---

## 4. Interaction with what exists

### The Foraxx-classic parity promise

The promise is that *Foraxx — classic* at defaults produces a starless image
identical bit for bit to the original. It is pinned literally in
`tests/expressions.test.js`.

It is safe by construction, on three independent grounds:

1. `linearEnabled` defaults to `false`, and `fxStretchMapFor` must keep
   returning `null` when neither switch is on. `ctx.stretch == null` makes
   `fxPrepareChannels` skip `fxStretch` entirely (`FXExpressions.js:203-205`) and
   the emitted strings are byte-identical.
2. `linearEnabled` is **not** listed in any `FXStyles[].values` block, so
   selecting a style cannot turn it on. This is the same discipline that keeps
   `normalizeEnabled` out of the style table.
3. The parity assertions in `expressions.test.js` construct their context
   without a `stretch` key at all, so they exercise the null path directly.

The only edit that could break it is `fxCollectStretch`'s guard
(`FXProcessing.js:1443`), which must become
`if ( !p.normalizeEnabled && !p.linearEnabled ) return null;` — a widening, never
a narrowing.

### The levels sets and the 2.7.0 trap

`sourceChanged()` resets all three sets. Confirmed that this covers the
persistence hazard as well: `FX.siiView` and friends are excluded from
`FXDefaults` and from `FXPersisted`, `reloadViewLists` only restores
`list.currentView` from an `FX` slot that is `null` at startup, so no source is
selected when the dialog opens and the user's first selection fires
`sourceChanged()` — clearing any black point restored from a settings file or a
process icon before it can be applied to unfamiliar data.

**One new trigger is required.** Toggling `linearEnabled` changes the render's
brightness scale by two to three orders of magnitude — as complete a change as
swapping the source. `this.linearBar.onCheckSection` must call
`this.sourceChanged()` (or its reset half) rather than just `requestPreview()`.
Moving `linearTarget` or `linearShadow` must **not** reset: those are continuous
and the user is watching the result move.

Also: `fxLevelsInForceElsewhere` already names off-screen sets in the status
line. That message becomes more important, not less, once the auto stretch can
change what "0.30 black point" means.

### The one-pipeline invariant

Intact and unaffected. `FXPreview.js:622-623` calls
`fxCollectStretch( p, false )` and `fxCollectStretch( p, true )` with the
**full-resolution** `p.siiView` / `p.haView` / `p.oiiiView` / `p.*StarsView`,
and hands the resulting `{c0,m}` map to the same `fxRender` that Execute uses on
the same downsampled channel ids. Statistics come from full resolution;
expressions are identical; only spatial sampling differs. Nothing in this design
gives the preview a code path of its own.

There is one *measurement* divergence it does not cover, quantified in §6 R4.

### Process icons and settings migration

Add to `FXPersisted`:

```
[ "linearEnabled", "boolean" ],
[ "linearTarget",  "real"    ],
[ "linearShadow",  "real"    ],
```

and to `FXRanges`:

```
linearTarget: [ 0.02, 0.50, 3 ],
linearShadow: [ -6.00, 0.00, 2 ],
```

`tests/parameters.test.js` enforces both directions generically — every non-View
parameter must be persisted, and every ranged control must have a default inside
its range — so omitting either fails the suite. That is the guard; no bespoke
test is needed for the plumbing.

**No `paletteSchema` bump and no migration function.** Deliberate, and different
from `fxMigrateHdrEnabled`. That migration existed because a pre-2.3.3 file
carried *live* HDR amounts that had run unconditionally, so absence of the key
did not mean absence of the behaviour. Here, absence of `linearEnabled` means the
file was written by a version that did not stretch, so `false` — the value
`fxLoadSettings` leaves in place when `Settings.lastReadOK` is false — is already
the correct answer. Adding a migration would be the risk, not the safety.

One thing a migration *cannot* fix and that must be said in the release note: a
process icon saved from 2.6.1 or earlier carries `starStretch: 1.00` chosen for
conditioned linear data, and the persisted level sets from that session. The
level sets are cleared at the first source selection; the star stretch is not.
See R3.

---

## 5. Test plan

### 5.1 `tests/normalization.test.js` — assertions that must change

**Block at lines 126-158, "LINEAR INPUT. The load-bearing test."**

The *assertions* stay true and stay valuable — they pin the normalization-only
path, which does not change. What must change is the header comment (lines
126-140), which currently tells the reader that a channel landing somewhere
bright means "someone has introduced an absolute stretch target… and when it
happens, the README, the dialog banner and the file header all have to stop
saying linear is unsupported." That is now a completed instruction, and leaving
it reads as though the feature does not exist. Rewrite it to:

> Channel normalization on its own is a RELATIVE statement, and on linear data it
> still leaves everything black. That is not a bug and it is not the linear path
> — it is why the linear path needed an absolute target of its own. The two
> switches are independent; this block pins the one with `linearEnabled` off.

Rename the block heading from `LINEAR INPUT` to
`NORMALIZATION ALONE IS NOT A STRETCH`.

Line 155 — `near( out, 0.001, key + ' lands on the 0.001 clamp, not on a display level', 1e-5 )` —
change the *message*, not the number: `'lands on the reference channel's own median, clamped'`.
The value 0.001 is correct for these particular synthetic medians (refMedian
after black point is 3.0e-5, below the clamp) but the clamp is incidental; on the
real reference set the same code lands at 0.00256 without ever touching it.

**Block at lines 165-176, the empty-reference warning.** Line 174 asserts the
console message contains `/NON-LINEAR/`:

```js
ok( fx.fxTestConsole().warnings.some( w => /NON-LINEAR/.test( w ) ),
    'with the linear requirement named, because that is the usual cause' );
```

The message it matches (`FXProcessing.js:357-359`) says *"these images may still
be linear — this script needs NON-LINEAR data"*, which stops being true. Change
the message to point at the switch, and the assertion with it:

```js
ok( fx.fxTestConsole().warnings.some( w => /Linear input/.test( w ) ),
    'and is pointed at the switch that handles it' );
```

**Line 77** — `eq( fx.fxCollectStretch( p, false ), null, ... )` — keep, and add
its complement: with `linearEnabled: true` and `normalizeEnabled: false`,
`fxCollectStretch` must return a map.

### 5.2 New assertions

**Absolute target.** With `linearEnabled: true`, `normalizeEnabled: false`, and
the six measured medians from the reference set as `fxTestView` statistics:

```js
for ( const [ id, st, expectC0, expectM ] of [
   [ 'S', { median: 3.291e-3, madn: 2.928e-4, minimum: 2.292e-3 }, 2.4710e-3, 2.4618e-3 ],
   [ 'H', { median: 7.062e-3, madn: 1.976e-3, minimum: 3.663e-3 }, 3.6632e-3, 1.0164e-2 ],
   [ 'O', { median: 5.717e-3, madn: 2.342e-4, minimum: 4.733e-3 }, 5.0614e-3, 1.9748e-3 ] ] )
```

- `map[k].c0` matches `expectC0` to 1e-6;
- `map[k].m` matches `expectM` to 1e-6;
- `fxMTFValue( map[k].m, (median - c0)/(1 - c0) )` is `0.25` to 1e-6 — **for all
  three, on one absolute number, with no reference channel involved**;
- `H`'s `c0` equals its `minimum` exactly (the pin fired);
- `S` and `O`'s `c0` are strictly above their minima (the pin did not fire).

**Target × boost composes.** `linearTarget: 0.25`, `normalizeEnabled: true`,
`normSii: 1.2, normHa: 1.0, normOiii: 0.8` → the three medians land on 0.300,
0.250, 0.200 to 1e-6, and the result is independent of `normalizeRef` (assert
with `normalizeRef` at 0, 1 and 2 — the same map three times).

**The 2.6.1 rule.** `fxCollectStretch( p, true )` with the three star-frame
statistics must return, for each key, `m` **identical** to the starless map's `m`
and `c0` of `0` (all three pin below the emission threshold). Then, using the
measured `m = 1.0164e-2`: void `3.210e-6` → `0.0003`, `1e-3` → `0.0564`,
`1e-2` → `0.3764`, `0.1` → `0.8691`, `0.5` → `0.9835`, each to 1e-3. And the
anti-assertion: a star frame solved its own 0.25 target puts the void at 0.25 and
the screen combination floor at 0.4375 — a comment-only companion, or a direct
assertion on `1 - (1-0.25)*(1-0.25)`.

**Parity.** `fxStretchMapFor` returns `null` when both switches are off, and
`fxBuildExpressions` with a `stretch: null` context emits a string equal to the
one with no `stretch` key at all.

**Emission at the boundary.** Extend `tests/emission.test.js`: for post-black-point
medians of 1e-3, 1e-4, 1e-5, 5e-6, 1e-6, 5e-7, 1e-7 at target 0.25, evaluating
the string `fxStretch` actually emits must land the median within 0.5 % of 0.25.
This is the assertion that would have caught fault (a), and it fails on a
six-decimal writer at 5e-6 and below.

**Degenerate statistics.** MADN = 0 and median = minimum both produce a channel
that is still stretched, with the shadow clip dropped and a warning on the
console; median = 0 produces `null` and a different warning.

**Status line.** `fxLooksLinear` is unchanged and its four existing assertions
stand. Add the `hdrEnabled` `note =` / `note +=` fix as a comment-level note —
it is in `FXDialog.js` and therefore a hand gate, not a node assertion.

### 5.3 PixInsight hand gates

The node harness cannot run PixelMath. These are the gates for
`docs/RELEASING.md`, all on the `testset/` masters named above.

| gate | procedure | assertion |
|---|---|---|
| **G1 parity** | *Foraxx — classic*, defaults, `linearEnabled` off, on **stretched** masters. `PixelMath` difference against the archived reference master | identically zero |
| **G2 the reported bug** | Same, on `S`/`H`/`O` linear, `linearEnabled` off, normalization on, ref Ha | starless median 0.006–0.008 — black. This gate asserts the *old* behaviour still happens when the switch is off |
| **G3 the fix** | `linearEnabled` on, target 0.25, shadow −2.80, normalization off | starless median R/G/B = **0.247 / 0.251 / 0.250** ± 0.005; no channel median differs from another by more than 0.01 |
| **G4 per-channel landing** | Same, `Statistics` on each intermediate channel after the stretch | `S`, `H`, `O` medians all 0.250 ± 0.002 |
| **G5 the pin** | Same, `Statistics` minimum on the stretched `H` | **0.000**, not 0.114. Unpinned code fails this gate |
| **G6 star frames** | `makeStars` on, `starStretch` 0, preview target = stars | stars image median ≤ 0.005; p99.9 ≥ 0.90; combined median **0.259** ± 0.005 — i.e. within 0.005 of the starless median, not 0.46 |
| **G7 the 2.6.1 anti-gate** | Temporarily force `fxCollectStretch` to solve the star frames their own stretch | combined median rises to **0.46**. Run once, by hand, to confirm the gate can fail |
| **G8 preview/Execute** | Preview at Detail 1:1 vs. Execute, starless target | pixel-identical |
| **G9 preview sampling** | Preview at Detail 1:8 vs. Execute, stars target | star background within the tolerance of R4; the status line names the divergence |
| **G10 normalization interaction** | `linearEnabled` + normalization, boosts 1.2 / 1.0 / 0.8 | channel medians 0.300 / 0.250 / 0.200 ± 0.005; "Reference" and "Shadow point" greyed |
| **G11 the marker trap** | Set a black point of 0.30 on the starless histogram, then toggle `linearEnabled` | all three level sets return to identity and the status line says so |
| **G12 misuse** | `linearEnabled` on with **stretched** masters | status line warns; result is over-stretched but not black or NaN |
| **G13 process icon** | Save an icon with `linearEnabled` on, restart, reload | the three new keys restore; a 3.0.1 icon loads with `linearEnabled` false |

**Reference data required**, all of which now exists except the last two:

- the six linear masters in `testset/` — **named as the linear reference set** in
  `docs/RELEASING.md`;
- a stretched set derived from them, for G1 and G12: run
  `HistogramTransformation` at the same auto-stretch parameters and save
  alongside, so the two sets differ in exactly one respect;
- the archived *Foraxx — classic* starless reference master for G1, which the
  parity gate already names.

---

## 6. Risk register

Ranked by expected damage, worst first.

**R1 — The auto stretch is an STF, and an STF is not a good final stretch.**
This is the honest core of the risk. One MTF per channel compresses the
highlights hard: measured on the reference set at target 0.25, the `H` channel's
p99 lands at 0.777 and its p99.9 at 0.835, so the top 1 % of the nebula occupies
6 % of the range. Users who compare against a GHS or masked stretch will find it
flat, and some of them will file that as a bug. *Guard:* say it in the section
tooltip, in the README, and in the release note — "this is PixInsight's
auto-stretch, applied for real; it gets you a workable colour image, not a
finished one." Give the target slider a range that reaches 0.05 so the user can
at least choose where the compression sits. Do not attempt a two-parameter or
hyperbolic stretch in this release: that is a second feature with its own four
failed attempts waiting for it.

**R2 — Someone reintroduces the relative target.** The two paths share
`fxChannelTransform`, and the normalization-only branch legitimately uses
`referenceMedian × boost` clamped at 0.001. A refactor that unifies them will
reintroduce fault (b) and the failure is silent and total. *Guard:* the two
target computations stay in visibly separate branches with the comment block from
`FXProcessing.js:219-234` kept and extended; the node assertion in §5.2 that all
three channels land on 0.25 *with `normalizeRef` at each of 0, 1 and 2* fails
immediately if any reference median re-enters the calculation.

**R3 — `starStretch` defaults to 1.00, and the auto stretch is a stretch.**
This is fault (d) in a milder form. With the auto stretch on, the star frames
already receive the nebula's curve — a lift of roughly 3000× at the low end.
`starStretch: 1.00` then multiplies by 3 on top. Measured over 400 000 real
pixels:

| | stars p95 | stars p99 | combined p99 | combined p99.9 |
|---|---|---|---|---|
| k = 0 | 0.0818 | 0.4721 | 0.8459 | 0.9588 |
| k = 1.00 (current default) | 0.2108 | 0.7285 | 0.8734 | 0.9836 |

Survivable — nothing like 2.4.0's 243× — but it is a second stretch stacked on
the first and the star void median rises from 0.001 to 0.006. *Guard:* **do not
change the default.** `starStretch` is shared with the non-linear path and moving
it changes behaviour for every existing user, which the parity discipline
forbids for no gain. Warn in the status line instead (§3), and say in the README
that 0 is the right value when Linear input is on. Revisit only with its own
release and its own gate.

**R4 — Peak-first downsampling and a star black point disagree.** Fault (c)'s
fix takes the *maximum* of each block. That is right for the peaks and wrong for
the background: the previewed star-frame background is the max of N² noise
samples, not the median. Measured directly on the real star frames:

| view | 1:1 median | 1:2 max-pool | 1:4 | 1:8 | 1:8 / 1:1 |
|---|---|---|---|---|---|
| `S_stars` | 8.596e-6 | 9.974e-6 | 1.334e-5 | 2.972e-5 | 3.5× |
| `H_stars` | 3.210e-6 | 3.681e-6 | 4.819e-6 | 9.801e-6 | 3.1× |
| `O_stars` | 2.474e-6 | 2.800e-6 | 3.522e-6 | 6.269e-6 | 2.5× |

Through the shared curve, with the star black point at 0 as measured:

| view | Execute | preview 1:2 | preview 1:4 | preview 1:8 |
|---|---|---|---|---|
| `S_stars` | 0.0035 | 0.0040 | 0.0054 | **0.0119** |
| `H_stars` | 0.0003 | 0.0004 | 0.0005 | **0.0010** |
| `O_stars` | 0.0012 | 0.0014 | 0.0018 | **0.0032** |

A 3.4× error at 1:8, but in absolute terms 0.0035 → 0.0119 — invisible against a
0.25 background, and it makes the preview *pessimistic* (star void slightly
brighter than final), which is the safe direction. This is not a one-pipeline
violation: the statistics are still measured on full resolution and the
expressions are still identical. It is an unavoidable consequence of sampling by
maximum. *Guard:* extend the existing 1:8 star-sampling status message
(`FXDialog.js:352-358`) to mention the background as well, and make G9 assert the
tolerance rather than equality. Note it in `docs/ARCHITECTURE.md` beside the
one-pipeline paragraph so nobody later "fixes" it by measuring on the preview
copies — which *would* be a violation.

**R5 — The black point is signal-dependent.** MADN on a nebula-filled frame is
inflated by the nebula: on `H` it is 28 % of the median where on `O` it is 4 %.
A frame that is almost entirely nebulosity will have a black point far below its
own floor. *Guard:* the pin at the frame minimum, which is what makes this
bounded rather than open-ended (§2.2, and G5 asserts it). Residual risk: a frame
whose minimum is a registration zero has no pin, and reverts to PI's behaviour —
acceptable, because that is a strictly better outcome than today's.

**R6 — The greyed normalization controls surprise someone.** A user with
"Shadow point" tuned turns on Linear input and their setting stops doing
anything. *Guard:* grey rather than hide, so the value is still visible; append
the reason to both tooltips. This is the same discipline `fxSanitize` applies to
`blend` on a fixed palette — except that here the stored value stays and is
simply unread, which is the milder case, and the sanitizer must **not** zero it.

**R7 — Six decimals on pedestal-free data.** Not a risk in HEAD, which emits
twelve. It becomes one the moment somebody "simplifies" `fxNum` back to a single
format string on the grounds that the reference set never exercises the deep
branch. *Guard:* the boundary sweep in §5.2 and the comment in
`FXExpressions.js:79-88`, which already explains it and must not be trimmed.

### Should this ship?

**Yes, under four conditions. Not otherwise.**

The 3.0.0 decision was right at the time and the reasoning behind it was sound.
What has changed is not the argument but the evidence: four of the five faults
that made it unshippable are fixed in the tree today, the fifth has a closed-form
answer, and there is now a real linear master set to prove it on rather than a
hypothesis. Every number in this document came from that set.

The conditions:

1. **Off by default, behind an explicit switch.** No detection-driven arming.
   The parity promise depends on it and so does diagnosability.
2. **G1 through G7 pass on the reference set, and G7 is confirmed to fail when
   deliberately broken.** A gate that has never been seen to fail is not a gate.
3. **The claim in the UI matches what it does.** "Auto-stretch linear masters as
   they are combined", not "linear input supported". R1 is real; the banner and
   the tooltip must say what the user is getting.
4. **A second linear set, from different equipment, before the tag.** The
   `testset/` masters have a pedestal at 2–5e-3. A pedestal-subtracted set at
   1e-5 exercises the twelve-decimal path (§1) and the black-point pin under
   completely different conditions, and it is exactly the data that broke 2.3.4.
   One set is a demonstration; two is a test.

If condition 4 cannot be met, ship stages 1 through 6 of §7 behind the switch
and mark the feature **experimental** in the README, with the tested depth range
stated numerically. Do not describe it as supported on data nobody has run it on.
That is the mistake 2.1.0 made.

---

## 7. Staged implementation plan

Each stage is independently verifiable and leaves the tree green. Smallest first.

**Stage 1 — parameters only. No behaviour.**
Add `linearEnabled: false`, `linearTarget: 0.25`, `linearShadow: -2.80` to `FX`;
the three `FXPersisted` entries; the two `FXRanges` entries.
*Verify:* `bash tests/run.sh` — `parameters.test.js` picks them up generically
and its count rises. Nothing else changes; every expression is byte-identical.

**Stage 2 — the black point function, unwired.**
Add `fxStfBlackPointFor( stats, p )` implementing §2.2 including the pin and the
`1e-6` drop. Export it. Nothing calls it.
*Verify:* new node assertions for the three measured `c0` values, the pin firing
on `H` and not on `S`/`O`, and all three star frames pinning to 0.

**Stage 3 — the target, unwired.**
Add `fxAutoStretchTargetFor( p, key )` returning `p.linearTarget × boost(key)`
when `normalizeEnabled`, else `p.linearTarget`.
*Verify:* the composition table of §2.3 as assertions, including independence
from `normalizeRef`.

**Stage 4 — wire the branch into `fxChannelTransform` and `fxStretchMapFor`.**
Branch on `p.linearEnabled` for both `c0` and `target`; add the two-stage
fallback of §2.5; widen `fxCollectStretch`'s guard to
`!p.normalizeEnabled && !p.linearEnabled`; make `fxCollectStretch`'s star-frame
`c0` follow the same branch. Reword the two console warnings that name
"NON-LINEAR data".
*Verify:* the full §5.2 assertion set, including the star-frame numbers and the
parity null-path assertion. **This is the stage where the feature works**, with
no UI to reach it — drive it from the node harness before adding a single control.

**Stage 5 — the emission boundary sweep.**
Add the §5.2 boundary assertions to `emission.test.js`. No production code.
*Verify:* they pass at twelve decimals; confirm by hand that reverting `fxNum` to
six decimals fails them at 5e-6 and below, then revert the revert.

**Stage 6 — the dialog section.**
The `SectionBar`, two `fxNumericRow`s, the greying in `updateControls`, the
`onCheckSection` calling `sourceChanged()`. Fix the `note =` / `note +=` bug on
`FXDialog.js:353` in the same commit.
*Verify:* `node --check` via the harness; then G3, G4, G5, G6, G10, G11 by hand
in PixInsight.

**Stage 7 — banner, status line, `#feature-info`, file header.**
*Verify:* G12 and the two directions of the detection message by hand.

**Stage 8 — the gates and the documentation.**
`docs/RELEASING.md` gains G1–G13 and names `testset/` as the linear reference
set. `docs/ARCHITECTURE.md` gains the R4 note beside the one-pipeline paragraph.
`README.md` loses the three "not supported" passages and gains a Linear input
section with the measured landing values. The version-history block gains an
entry that says what was wrong, what is fixed, and — in the same tone the 3.0.0
entry set — what is still only an auto-stretch.
*Verify:* `bash scripts/check-package.sh`; full gate sweep; second linear set per
condition 4.

---

## Appendix — adversarial pass

For each historical fault: *would this design have produced it?*

**2.3.4 (a), the black nebula from six-decimal emission.** No, but only because
`fxNum` already switched to twelve decimals. My design's `m` values on the
reference set are 2.5e-3 to 1.0e-2, where six decimals carry four significant
figures — this set would not have caught the fault at all. On a pedestal-free
set at 1e-5 background, `m = 2.1e-5`, and six decimals give `0.000021`, which
still lands on 0.2500. The fault only bites below `m = 5e-6`, i.e. a background
under 2.4e-6. **So the design does not reproduce it, and neither would the
reference set have detected it.** That is why §5.2 asserts the boundary
synthetically rather than trusting the masters.

**2.3.4 (b), normalization pinning everything to the clamp.** No. The clamp is
unreachable on the absolute path — `target ≥ 0.02 × 0.20 = 0.004`, four times the
floor — and the reference median never enters the calculation. Verified by
asserting the same map at all three `normalizeRef` values. The specific failure
mode, all three channels landing on the *same* value regardless of their own
medians, is impossible when the target is `T × boost(k)` with the boosts at their
defaults of 1.00: they land on the same value *by intent*, and diverge the moment
a boost moves, which the 0.001 clamp never did.

**2.3.5, previewed stars unlike Execute's.** Not reintroduced — the peak-first
downsample is untouched. But the design *does* create a new, smaller divergence
of the same family, which I found only by measuring: the max-pool that preserves
peaks also lifts the background, by 3.4× at 1:8 on `S_stars`. Through the curve
that is 0.0035 → 0.0119. The 2.3.5 gap was 0.43 vs 0.93 — 0.50 in output units.
Mine is 0.008. Two orders of magnitude smaller, and in the pessimistic direction.
I am declaring it acceptable and disclosing it (R4) rather than pretending it is
zero.

**2.4.0, star cores driven to flat white by an unconditional 243×.** No — the
stretch is optional and slider-driven. But the *mechanism* recurs at reduced
scale: the default `starStretch: 1.00` is a 3× lift on top of a curve that
already lifts by ~3000× at the low end, and it takes the combined p99.9 from
0.959 to 0.984. 2.4.0's own diagnosis was "that was survivable while the linear
auto stretch was broken; once it was fixed, the extra stretch had a properly
exposed channel to work on." **That sentence applies word for word to the current
default of 1.00.** I am not changing it — parity outranks it, and 3× is not 243×
— but R3 exists because the same trap is one order of magnitude away, and the
honest answer is a warning rather than a claim that it cannot happen.

**2.6.1, the grey floor from star frames solved their own stretch.** No, and this
is the one I can rule out with the strongest numbers, because I reproduced both
sides on the real masters. Shared curve with own black point: stars median
0.0010, combined median 0.2590 — the nebula's own level, moved by 0.008. Own
stretch: stars median 0.2565, combined median 0.4625, p95 0.9797. The design
takes the first path, `fxCollectStretch` already implements it, and G7 exists
specifically to prove the gate can still catch a regression here.

**2.7.0, level markers carried across a source change.** No — `fxResetAllLevels`
is unchanged and fires on source selection, which also disarms any set restored
from a settings file or a process icon before it can meet unfamiliar data. But
2.7.0's underlying failure was *a set tuned on stretched data reapplied to a
fresh linear render*, and toggling `linearEnabled` produces exactly that
transition without touching a source. That is a new door onto the same room, and
the design closes it explicitly: `onCheckSection` calls `sourceChanged()`. Miss
that one line and 2.7.0 returns in full.
