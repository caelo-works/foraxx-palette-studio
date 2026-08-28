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
| `pjsr/lib/FXStrings.js` | Every string the interface shows, in English and French |
| `pjsr/lib/FXProcessing.js` | The pipeline: runs the expressions and the stock processes |
| `pjsr/lib/FXDialog.js` | The dialog and every control on it |
| `pjsr/lib/FXPreview.js` | Downsampled render, caching, zoom and pan |
| `pjsr/lib/FXHistogram.js` | The histogram widget and its levels markers |
| `pjsr/assets/ForaxxPaletteStudio.svg` | Menu icon, installed to `rsc/icons/script/` |

`FXParameters.js`, `FXStrings.js`, `FXExpressions.js` and `FXProcessing.js` load
under the test shim, so the node harness bundles and drives all four — the
expression writer, the parameter surface, the conditioning arithmetic and both
string tables. `FXDialog.js`, `FXPreview.js` and `FXHistogram.js` build
PixInsight controls at load time and are only parsed; they are verified by hand
in PixInsight.

## Language

`FX_UI` in `FXStrings.js` holds one table per language and `fxT( key )` reads
the current one, falling back to English and then to the key itself. A control
keeps the key it was built from and exposes `retranslate()`, so switching
language rebuilds the text in place rather than the dialog. Accented characters
are written as `\uXXXX` escapes: the file travels through a preprocessor and a
zip, and an escape cannot be mangled by either.

`tests/strings.test.js` holds the structure to it: the two tables must carry the
same keys and the same markup, every key must be read somewhere, every `fxT()`
call must name a key that exists, and no English sentence may be hard-coded in
the dialog. Each of those four failed at least once while the translation was
being written.

Image identifiers and console output are deliberately not translated. They are
what the user types and what they paste into a forum post.

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

`fxBuildExpressions( p, maskCtx, valueCtx )` takes the masks from one context
and the values from another, so the star channels could be combined through the
nebula's masks — the original's behaviour. **The split is dormant today:** both
call sites pass the same context twice, because since 2.4.0 the stars go through
the broadband combination instead. The parameter is kept because it is what the
signature means, not because anything currently exercises it.

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

Floating point, whatever the source is. The dynamic factors involve fractional
powers, and rounding those into a 16-bit integer container bands visibly in the
transition zones the palette is built around. `fxSampleFormat32` asks PixelMath
for `f32`, then `f64` — wider than asked for still honours the invariant, which
is "not an integer container" rather than "exactly 32 bits" — and only then
falls back to the source format, warning once a run when it does.

Existing identifiers are never overwritten: a numeric suffix is added to the
whole group at once, so `Warhol01`, `Warhol01_stars`, `Warhol01_combined` and
`Warhol01_L` always match.

## The JavaScript engine

`#engine v8`, and it is not optional: the macOS arm64 build of 1.9.4 ships no
SpiderMonkey at all, so without the directive the script refuses to start. That
sets the floor at PixInsight 1.9.0.

Two things follow from it, both measured with a probe run headless
(`PixInsight -n --automation-mode -r=probe.js --force-exit`, writing its findings
to a file) rather than assumed:

- **The core classes are built-in globals.** `Sizer.jsh`, `NumericControl.jsh`
  and `SectionBar.jsh` declare `HorizontalSizer`, `NumericControl` and
  `SectionBar` as plain functions, and V8 refuses the redeclaration outright.
  Those three headers must not be included. The constant headers must:
  `StdCursor_*`, `TextAlign_*`, `FrameStyle_*`, `StdIcon_*`, `StdButton_*`,
  `StdDialogCode_*` and `DataType_*` are *not* built in.
- **Subclassing is ES classes.** The `this.__base__ = Dialog; this.__base__();`
  pattern calls a class constructor as a function, which V8 rejects.
  `ForaxxStudioDialog`, `FXPreviewControl` and `FXLevelsControl` are
  `class X extends Y` with a `super()` call.

- **Process enumerators are static on the constructor.** `PixelMath.RGB`, not
  `PixelMath.prototype.RGB`, which is `undefined` under V8. Assigning that to a
  process parameter fails as "signed integer value expected", which is how the
  preview stopped rendering while the dialog opened perfectly. The same applies
  to `SCNR`, `ColorSaturation`, `CurvesTransformation`, `ChannelExtraction` and
  `IntegerResample`. `tests/shim.js` mirrors this deliberately: a shim that put
  them on the prototype would let the whole suite pass against an API that does
  not exist.
- **The bare `processEvents()` is deprecated** and warns on every call.
  `fxProcessEvents()` prefers `CoreApplication.processEvents`.
- **A thrown value is not always an `Error`.** Reading `.message` off a string
  gives the literal word "undefined", which swallowed the cause of the failure
  above. `fxErrorText()` is what every catch clause reports through.

A class body is strict mode, so everything inside those three constructors now
is too. `tests/undefined.test.js` is what guards the accidental global that
would previously have been silent.

## Known deviations from the CaeloWorks house standard

- **CC BY-NC 4.0, not GPL-3.0.** Not a choice — see `LICENSE` and `NOTICE.md`.
