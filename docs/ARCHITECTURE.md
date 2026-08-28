# Architecture

A dialog around a PixelMath pipeline. Everything the script produces is a
PixelMath expression string or a stock PixInsight process instance — there is no
pixel arithmetic in JavaScript anywhere, which is why the preview can be exact
rather than approximate.

## Files

| File | What lives there |
|---|---|
| `pjsr/ForaxxPaletteStudio.js` | Feature declaration, entry point, the console report |
| `pjsr/lib/FXParameters.js` | The `FX` parameter object, defaults, the style table, persistence, process icons |
| `pjsr/lib/FXExpressions.js` | **Pure logic.** Every PixelMath expression string |
| `pjsr/lib/FXProcessing.js` | The pipeline: runs the expressions and the stock processes |
| `pjsr/lib/FXDialog.js` | The dialog and every control on it |
| `pjsr/lib/FXPreview.js` | Downsampled render, caching, zoom and pan |
| `pjsr/lib/FXHistogram.js` | The histogram widget and its levels markers |
| `pjsr/lib/FXSplitter.js` | Draggable dividers |
| `pjsr/assets/ForaxxPaletteStudio.svg` | Menu icon, installed to `rsc/icons/script/` |

`FXParameters.js`, `FXExpressions.js` and `FXProcessing.js` load under the test
shim, so the node harness bundles and drives all three — the expression writer,
the parameter surface and the conditioning arithmetic. `FXDialog.js`,
`FXPreview.js`, `FXHistogram.js` and `FXSplitter.js` build PixInsight controls at
load time and are only parsed; they are verified by hand in PixInsight.

## The two invariants

**One pipeline.** The preview does not approximate. It makes hidden,
downsampled copies of the source channels once, then runs *the same* expression
strings and *the same* process instances that Execute runs. The only difference
is spatial sampling. Any change that gives the preview its own code path is a
bug, however convenient — 2.3.5 is the cautionary tale: the preview downsampled
star channels by averaging before a stretch that multiplies by 243, and the
previewed star reached 0.43 where the real one reached 0.93.

**Default output is frozen.** *Foraxx — classic* at defaults produces a starless
image identical, bit for bit, to the original Foraxx Palette Utility. Those are
Bill Blanshan's published expressions, pinned literally in
`tests/expressions.test.js`. Moving them is a major version.

## The expression layer

```
R = O^~O · S           + ~(O^~O) · H
G = (H·O)^~(H·O) · H   + ~((H·O)^~(H·O)) · O
B = O
```

The two dynamic factors are masks: `o` gates the Sii↔Ha transition, `ho` gates
Ha↔Oiii. Since 2.5.0 the transitions belong to **RGB slots**, not to channels:
red always carries Sii↔Ha, green always carries Ha↔Oiii, blue is the anchor and
is never blended. The Foraxx amount mixes each slot towards whatever channel the
current palette's mapping puts there, so amount 0 is exactly the permutation the
fixed palettes always were, and raising the amount on a fixed palette walks it
to its Foraxx counterpart rather than somewhere else. Per channel rather than
per slot would collapse green and blue to the same string in HOO.

The masks always come from the **starless** context even when the values come
from the star channels — `fxBuildExpressions( p, maskCtx, valueCtx )`. That is
the original's behaviour and is deliberate.

### Numeric emission rules

- **Fixed notation, six decimals** (`fxNum`). PixelMath's handling of
  exponential literals is what four separate faults turned on between 2.3.4 and
  2.6.1. Never reach for `%e`.
- **Leave large constants symbolic.** The star stretch emits `3^k` for PixelMath
  to evaluate rather than the midtones balance `1/(1+3^k)`, which is 1/6562 at
  k = 8 and does not survive six decimals.
- **Identity at the default.** `fxGain(x, 1)` returns `x`; `fxMix(a, b, 0)`
  returns `b`. A control at its neutral position must emit no arithmetic at all.

## Output

Always 32-bit floating point. The dynamic factors involve fractional powers, and
rounding those into a 16-bit container produces visible banding in the
transition zones.

Existing identifiers are never overwritten: a numeric suffix is added to the
whole group at once, so `Warhol01`, `Warhol01_stars`, `Warhol01_combined` and
`Warhol01_L` always match.

## Known deviations from the CaeloWorks house standard

- **No `#engine v8`.** The other scripts declare it. This one does not, because
  it is a working script inherited at 3.0.1 that has never run under that engine
  and the README supports PixInsight back to 1.8.9. Adding the directive is a
  behavioural change that needs a full pass of the PixInsight hand gates in
  `docs/RELEASING.md` before it goes in, not a drive-by alignment.
- **CC BY-NC 4.0, not GPL-3.0.** Not a choice — see `LICENSE` and `NOTICE.md`.
