# 03 — Parameters, persistence and entry point (`FXParameters.js`, `ForaxxPaletteStudio.js`)

Audit date: 2026-08-28. Scope: `pjsr/lib/FXParameters.js` (805 lines, read in full) and
`pjsr/ForaxxPaletteStudio.js` (386 lines, read in full), with `pjsr/lib/FXDialog.js`,
`FXProcessing.js` and `FXExpressions.js` read where they consume the parameter surface.
`docs/ARCHITECTURE.md` and `tests/parameters.test.js` read first. The harness was run
(`bash tests/run.sh` → 1262 assertions, all passing) and then driven directly: the bundled
`tests/build/module.js` was re-exported with `fxSanitize`, `fxLoadSettings`, `fxSaveSettings`,
`fxImportParameters` and the three migrations, and exercised under a mock `Settings` /
`Parameters` in a scratch directory. Every empirical claim below was produced that way.
Nothing in the repository was changed except the addition of this file.

## Executive summary

1. **The parameter surface itself is in good order.** All 59 `FX` keys are reachable from the
   rest of the tree; every non-view key is persisted (53 entries, no duplicates, no orphans);
   every `FXRanges` name is a real, persisted parameter; every style `values` key exists; no
   parameter is persisted-but-never-read except `paletteSchema`, which is bookkeeping by design.
2. **Corrupt numeric input cannot produce a NaN slider.** Driving `fxLoadSettings` with every
   persisted numeric key set to `NaN` and the levels inverted leaves *zero* non-finite values in
   `FX`, `baseId` restored to the style's id, and the levels back at identity. That invariant
   holds, and holds for the right reason: `fxSanitize` clamps every ranged value and falls back
   to `FXDefaults` for anything non-finite.
3. **The one real defect is in ordering, not in the tables.** `main()` runs `fxLoadSettings()`
   — which advances `paletteSchema` to the current schema — *before* `fxImportParameters()`, so
   every schema-gated migration is unconditionally skipped on the process-icon path (H1,
   reproduced). The 2.5.0 changelog promises icons are migrated; on the icon path they are not.
4. **Two more ordering faults follow from the same area:** the three migrations run *before*
   `fxSanitize` and two of them dereference `fxStyle( FX )`, which returns `undefined` for a
   non-integer `styleIndex` — a stored `7.5` or `NaN` throws a `TypeError` out of `main()` and
   the dialog never opens (M1, reproduced); and the dialog's "Reset all" restores
   `paletteSchema` to 1 from `FXDefaults`, re-arming the one-shot migrations, which then revert
   a Luminance preview target to Starless on the next launch (M2, reproduced).
5. **The Execute-vs-Close claim is false.** `main()` calls `fxSaveSettings()` unconditionally
   after `dialog.execute()`, and `runFinal` calls it again after each Execute. This is
   deliberate and commented as such; the residual hazard is that merely inspecting a dropped
   process icon and pressing Close overwrites the user's stored defaults (M3).
6. **`fxReport` is close to complete.** Every parameter that changes a *colour* image is
   reported, and each conditional line matches the corresponding gate in `FXProcessing`. The
   single gap is `hardO`/`hardHO` on a fixed palette, which are unreported yet still shape the
   optional `_o`/`_ho` factor images (L1) — the same class of hole 3.0.1 closed for `blend`.
7. **The test suite is strong on the tables and blind on the code that protects them.**
   `fxSanitize` and all three migrations have zero coverage and are not even exported from the
   bundle (M5); two assertions are weaker than the invariant they name (M4, L4); one collects
   style ids and asserts nothing (N2).

No Critical findings. Counts: High 1, Medium 5, Low 4, Nit 6.

---

## Findings

### High

#### H1. Schema-gated migrations never run on the process-icon path

- **Location:** `pjsr/ForaxxPaletteStudio.js:359-362`; `pjsr/lib/FXParameters.js:667-692`,
  `775-803`.
- **Evidence:** `main()` does `fxLoadSettings()` and only then, if
  `Parameters.isGlobalTarget`, `fxImportParameters()`. `fxLoadSettings` ends by running
  `fxMigratePaletteBlend()` and `fxMigratePreviewTarget()`, both of which *write*
  `FX.paletteSchema` (to 2, then 3). `fxImportParameters` then re-runs the same two
  migrations — but a process icon written before 2.5.0 carries no `paletteSchema` key, so
  `Parameters.has( "paletteSchema" )` is false, `FX.paletteSchema` is still 3 from the settings
  load, and both migrations return at their first line. Reproduced against the bundled module
  with an empty settings store and an icon of `{ styleIndex: 7 (SHO, fixed), blend: 1.00,
  previewTarget: 2 }`: `previewTarget` came back as **2** (Luminance) instead of the 0 that
  `fxMigratePreviewTarget` exists to produce, and `paletteSchema` was 3 throughout. The
  comment at `FXParameters.js:327-329` — "A file written before 2.5.0 has no such key, so it
  loads as 1 and the migration below runs exactly once" — is true of the settings path only.
- **Why it matters:** the CHANGELOG for 2.5.0 states "A settings file **or process icon** from
  an earlier version is migrated". For icons that is false. Today's blast radius is limited:
  the `blend` half of the promise is caught anyway by the belt-and-braces rule added in 3.0.1
  (`fxSanitize`, line 637-638), so a pre-2.5.0 fixed-palette icon does *not* come back as a
  full dynamic Foraxx — verified. What is left is a pre-3.0.0 icon whose stored `previewTarget`
  was 2 ("combined", a view that no longer exists) opening on the Luminance layer instead of
  Starless. The structural problem is larger than the symptom: the migration mechanism is dead
  on this path, so the *next* migration added — one that does change the output — will be
  silently skipped for every process icon, and the failure will look exactly like this one:
  invisible.
- **Fix:** make the import path independent of what the settings path already did. Simplest
  correct form — in `fxImportParameters`, before the migration calls:
  `if ( !Parameters.has( "paletteSchema" ) ) FX.paletteSchema = 1;`
  (mirroring how `hdrEnabled` is already handled correctly, by passing
  `Parameters.has( "hdrEnabled" )` into `fxMigrateHdrEnabled`). Better still, pass the observed
  schema explicitly — `fxRunMigrations( sawSchema ? FX.paletteSchema : 1 )` — so neither path
  depends on the residue of the other.

### Medium

#### M1. `fxStyle()` returns `undefined` for a non-integer index, and the migrations dereference it before `fxSanitize` can clean up

- **Location:** `pjsr/lib/FXParameters.js:216-222` (`fxStyle`), `671`
  (`fxMigratePaletteBlend`), `694-736` (`fxLoadSettings`), `775-803` (`fxImportParameters`).
- **Evidence:** `fxStyle` guards `i < 0 || i >= FXStyles.length` and nothing else. With
  `styleIndex = NaN` both comparisons are false, so `FXStyles[NaN]` → `undefined`; the same for
  `7.5`. Both `fxMigratePaletteBlend` (`if ( !fxStyle( FX ).dynamic )`) and `fxSanitize` call
  it, but the migrations run **first** — deliberately, per the comment at lines 680-682 ("Has
  to run before fxSanitize"). Reproduced: a settings store with `styleIndex = 7.5` (and again
  with `NaN`) throws
  `TypeError: Cannot read properties of undefined (reading 'dynamic')` out of
  `fxMigratePaletteBlend` → `fxLoadSettings` → `main()`.
- **Why it matters:** `main()` has no `try`/`catch`, and the throw happens before
  `new ForaxxStudioDialog` — the script does not open at all, with a raw console `TypeError`
  and no message. The user cannot reach the dialog to fix the value, and the bad value is in
  their settings, so every subsequent launch fails the same way. The same throw is reachable
  from `fxImportParameters`, i.e. from double-clicking a malformed process icon. Reachability
  is the caveat: PixInsight's `Settings.read(..., DataType_Int32)` and
  `Parameters.getInteger()` normally coerce to a whole number, so this needs a stored value
  that is not one (a hand-edited icon, a foreign build, a type mismatch in the store). It is
  cheap to make impossible.
- **Fix:** harden the single accessor everything funnels through, rather than the callers:

  ```js
  function fxStyle( p )
  {
     let i = p.styleIndex;
     if ( typeof i != "number" || !isFinite( i ) || i != Math.round( i )
       || i < 0 || i >= FXStyles.length )
        i = 0;
     return FXStyles[i];
  }
  ```

  `fxSanitize`'s own `styleIndex` block already does exactly this check; moving it into
  `fxStyle` makes all 17 call sites across `FXExpressions`, `FXProcessing`,
  `FXDialog` and `fxReport` safe at once.

#### M2. "Reset all" rewinds `paletteSchema`, re-arming the one-shot migrations

- **Location:** `pjsr/lib/FXParameters.js:327-329` (`paletteSchema` declared inside `FX`),
  `399-405` (`FXDefaults` capture), `683-692` (`fxMigratePreviewTarget`);
  `pjsr/lib/FXDialog.js:1511-1519` (the Reset all body).
- **Evidence:** `FXDefaults` is built from `FX` excluding only keys containing `"View"`, so it
  contains `paletteSchema: 1`. "Reset all" is `for ( let key in FXDefaults ) FX[key] =
  FXDefaults[key];`, which sets `FX.paletteSchema = 1`. `fxSaveSettings` then persists 1.
  Reproduced end to end against a mock store: load → Reset all → set the preview target to
  Luminance (2) → save (`paletteSchema` written as 1, `previewTarget` as 2) → reload →
  `previewTarget` is **0** and `paletteSchema` is back to 3. `fxMigratePreviewTarget` had
  treated the legitimate 2 as the retired "combined" target.
- **Why it matters:** pressing a button labelled "Reset all", which promises to restore
  factory defaults, also puts the persistence layer back into a state where a migration written
  for files from another era runs against a current file. Today the visible cost is one silently
  reverted preview target per Reset-all-then-close cycle. Any future migration keyed on the
  schema would fire against modern data with the same silence.
- **Fix:** `paletteSchema` is bookkeeping, not a parameter, and should never be reset by a user
  action. Exclude it from `FXDefaults` the same way the views are
  (`if ( key.indexOf( "View" ) < 0 && key != "paletteSchema" )`), and, as a second belt, make
  the migrations monotonic: `FX.paletteSchema = Math.max( FX.paletteSchema, 3 )`.

#### M3. Settings are saved on Close as well as on Execute — the stated invariant is false, and a dropped process icon overwrites the user's defaults

- **Location:** `pjsr/ForaxxPaletteStudio.js:369-376`; `pjsr/lib/FXDialog.js:1599-1601`,
  `1623-1626`.
- **Evidence:** `main()` calls `fxSaveSettings()` unconditionally after `dialog.execute()`
  returns, whether the dialog was dismissed with Close (`dlg.cancel()`, line 1625) or after any
  number of Executes. `runFinal` also calls `fxSaveSettings()` after each successful render.
  There is no `StdDialogCode` test anywhere in the tree. The comment at lines 372-374 states
  the behaviour is intentional: "a session spent tuning and then closed without an Execute must
  not be thrown away."
- **Why it matters:** the invariant "only a run accepted with Execute becomes the new stored
  default" is not implemented and is not intended — this entry documents the refutation so it
  is not re-asserted later. The behaviour is also load-bearing in one direction: `paletteSchema`
  only advances because Close persists it, so making Close non-saving would re-arm every
  migration on every launch. The residual hazard is the interaction with process icons: because
  `fxImportParameters` merges an icon's values into `FX` *before* the dialog opens, a user who
  double-clicks somebody else's icon to see what is in it, then presses Close, has silently
  replaced their own stored defaults with that icon's. Nothing in the UI says so.
- **Fix:** keep the save-on-close behaviour, and correct the docs to match. If the icon hazard
  is to be addressed, the narrow change is to skip the final `fxSaveSettings()` in `main()` when
  `Parameters.isGlobalTarget` was true and `dialog.didRun` is false — an imported configuration
  that was never executed is not the user's new default — while still writing `paletteSchema`
  so the migration stays one-shot.

#### M4. The level-set ordering is load-bearing, duplicated in the dialog, and asserted only as a set

- **Location:** `pjsr/lib/FXParameters.js:354-358` (`FX_LEVEL_SETS`), `390-397`
  (`fxLevelsInForceElsewhere`); `pjsr/lib/FXDialog.js:1300-1311` (`FX_LEVEL_KEYS`), `343`;
  `tests/parameters.test.js:89-92`.
- **Evidence:** `fxLevelsInForceElsewhere( FX.previewTarget )` indexes `FX_LEVEL_SETS` with the
  preview-target enum (0 starless, 1 stars, 2 luminance), so the array order *is* the enum. The
  test asserts only `[ 'starless', 'stars', 'luminance' ].forEach( n => ok( names.indexOf( n )
  >= 0 ) )` — it passes with the table in any of six orders, five of which mislabel the status
  line. Separately, `FXDialog.js` keeps a second copy of the same table (`FX_LEVEL_KEYS`, same
  three key triples plus titles), also indexed by `previewTarget`, and `FXDialog.js` is not
  bundled by the harness — so a divergence between the two tables cannot be caught by any test.
- **Why it matters:** the split into three level sets exists because of the 2.7.0 bug in which
  one set was applied to an image it did not describe ("adjusting them while examining the stars
  quietly crushed the nebula"). The two things that could reintroduce it — a reordered
  `FX_LEVEL_SETS` and a drifted `FX_LEVEL_KEYS` — are both unguarded. The current tables agree;
  this is about the guard, not a live fault.
- **Fix:** (a) tighten the test to `eq( fx.FX_LEVEL_SETS.map( s => s.name ).join(),
  'starless,stars,luminance', ... )` with a comment saying the order is the `previewTarget`
  enum; (b) delete `FX_LEVEL_KEYS` from `FXDialog.js` and add the `title` string to
  `FX_LEVEL_SETS`, so the dialog reads the one table the harness can see.

#### M5. `fxSanitize` and all three migrations have no test coverage, and are not reachable from the harness

- **Location:** `pjsr/lib/FXParameters.js:565-644`, `654-692`; `tests/run.sh` (the
  `module.exports` block), `tests/parameters.test.js`.
- **Evidence:** the bundle exports `FX`, `FXStyles`, `FXDefaults`, `FXPersisted`, `FXRanges`,
  `FX_LEVEL_SETS`, `fxStyle`, `fxFirstStyleFor` and `fxLevelsAreIdentity` — not `fxSanitize`,
  not `fxMigrate*`, not `fxLoadSettings`/`fxSaveSettings`/`fxImportParameters`,
  not `fxApplyStyle`/`fxSetChannelCount`. `tests/parameters.test.js` therefore checks the
  *tables* exhaustively (888 assertions) and the *behaviour that reads them* not at all. All
  three of H1, M1 and M2 are pure-JavaScript faults with no PixInsight dependency that a dozen
  lines of test would have caught.
- **Why it matters:** these are precisely the functions that stand between a user's stored file
  and the dialog. The tables are the part least likely to break silently; the sanitiser and the
  migrations are the part most likely to.
- **Fix:** add `fxSanitize`, `fxMigrateHdrEnabled`, `fxMigratePaletteBlend`,
  `fxMigratePreviewTarget`, `fxApplyStyle` and `fxSetChannelCount` to the `module.exports` block
  in `tests/run.sh`, and assert: NaN/out-of-range in every ranged key comes back finite and
  in range; `levelsHigh <= levelsLow` resets both; a fixed palette forces `blend` to 0; a
  non-integer `styleIndex` does not throw; each migration is idempotent when run twice; a
  schema of 1 with `previewTarget` 3 lands on 2 and with 2 lands on 0. (Note for whoever does
  it: `FX_SETTINGS_KEY` is a `#define` and is stripped by `tests/run.sh`, so `fxLoadSettings`
  and `fxSaveSettings` cannot be driven under the harness as things stand — see N5.)

### Low

#### L1. `hardO` / `hardHO` are unreported and unpinned on a fixed palette, yet still shape the `_o` / `_ho` factor images

- **Location:** `pjsr/lib/FXParameters.js:632-638` (`fxSanitize` pins only `blend`);
  `pjsr/ForaxxPaletteStudio.js:291-297` (the Transitions line is inside
  `if ( fxStyle( FX ).dynamic )`); `pjsr/lib/FXDialog.js:1803-1805`;
  `pjsr/lib/FXProcessing.js:1227-1236`.
- **Evidence:** 3.0.1 held `blend` at 0 on the fixed palettes "so a greyed slider can never be
  hiding a value restored from a settings file or a process icon". The same greying applies to
  `hardORow` and `hardHORow`, but neither value is pinned. `fxBuildExpressions`
  (`FXExpressions.js:253-255`) computes `ho`, and `o` when Sii is present, *before* the blend
  is applied, and returns them; `fxRender` writes them out as `base + "_o"` and `base + "_ho"`
  whenever `makeFactors` is on, for any palette. The colour images are unaffected — `fxMix( a,
  b, 0 )` returns `b` — but the factor images are not.
- **Why it matters:** a user on a fixed palette with "keep the dynamic factor images" ticked can
  get two different `_o`/`_ho` images from two sessions with identical visible settings,
  because a hardness value restored from a settings file sits behind a greyed slider and the
  console report prints no Transitions line for a fixed palette. That is the exact failure mode
  3.0.1 set out to eliminate, in the one output it did not cover.
- **Fix:** in `fxSanitize`, next to the `blend` rule, also pin the hardness values on a fixed
  palette: `FX.hardO = FXDefaults.hardO; FX.hardHO = FXDefaults.hardHO;` — or, if the factor
  images are meant to remain tunable there, print the Transitions line whenever
  `fxStyle( FX ).dynamic || FX.makeFactors`.

#### L2. No persisted boolean is validated

- **Location:** `pjsr/lib/FXParameters.js:565-644` (`fxSanitize`), `725-730` (`fxLoadSettings`).
- **Evidence:** `fxSanitize` defends every number (the `FXRanges` loop plus the six explicit
  `clampInt`/scale cases) and the one string (`baseId`), and touches none of the twelve
  booleans. Driving `fxLoadSettings` with `"yes"` stored for every boolean key leaves
  `makeStars`, `normalizeEnabled`, `starCleanGreen`, `scnrEnabled`, `scnrPreserveL`,
  `hdrEnabled`, `makeLuminance`, `makeCombined`, `makeFactors`, `autoPreview` and `previewFit`
  holding the string `"yes"` in `FX`.
- **Why it matters:** defence in depth rather than a live fault — `Settings.read(...,
  DataType_Boolean)` and `Parameters.getBoolean()` both return real booleans in PixInsight, so
  a non-boolean should not arrive. But a truthy string is indistinguishable from `true` at
  every use site, so if one ever did arrive there would be no symptom to trace, and the
  `parameters.test.js` type assertions (lines 27-32) would not see it because they inspect the
  factory defaults, not a loaded file.
- **Fix:** one line at the top of `fxSanitize`'s loop over `FXPersisted`, or explicitly:
  `for ( let i = 0; i < FXPersisted.length; ++i ) if ( FXPersisted[i][1] == "boolean" )
  FX[FXPersisted[i][0]] = !!FX[FXPersisted[i][0]];`

#### L3. The `previewScale` comment describes a defence the code does not implement and does not need

- **Location:** `pjsr/lib/FXParameters.js:585-590`, against `331-334`.
- **Evidence:** the comment claims "Settings written by 2.3.1 and earlier hold a step index
  here, not a scale. Anything at or below the old maximum index of 5 that is not a plausible
  zoom is dropped rather than reinstated as a 5x view." The code below it is
  `if ( !isFinite( FX.previewScale ) || FX.previewScale <= 0 ) FX.previewScale = 1;` followed by
  a clamp to `[0.1, 10]` — there is no "plausible zoom" test and nothing is dropped; a stored 5
  survives as a 5x view. The declaration at line 331-334 explains that the key was *renamed*
  from the old `previewZoom` precisely so "a settings file from 2.3.1 cannot be misread as
  one", which makes the whole scenario the comment describes impossible.
- **Why it matters:** a maintainer reading this believes an old-format guard exists and is
  tested. It does not exist, and the rename already made it unnecessary. Misleading comments in
  a migration path are how the next migration gets written wrong.
- **Fix:** replace the three comment lines with the true reason — the key is new since 2.3.2 and
  the clamp exists only to survive a corrupt value.

#### L4. Nothing pins `styleIndex` to a style, so reordering `FXStyles` passes CI

- **Location:** `tests/parameters.test.js:110-155`, `161`.
- **Evidence:** the block's own comment states the hazard — "The dialog indexes into it and
  settings files store the index, so a reordering silently repoints everyone's saved palette" —
  and then asserts nothing that would detect one. `eq( fx.FX.styleIndex, 0, 'the script opens on
  Foraxx classic' )` checks that the default index is 0, not that index 0 is Foraxx classic;
  `eq( fx.fxStyle( { styleIndex: 0 } ), fx.FXStyles[0], ... )` is a tautology about `fxStyle`.
  Swapping `FXStyles[0]` (Foraxx classic) with `FXStyles[7]` (SHO) passes every assertion in the
  file.
- **Why it matters:** the test reads as a guard on a load-bearing invariant and is not one.
  Anyone adding a palette will reasonably assume CI covers the ordering.
- **Fix:** pin the mapping explicitly, e.g.
  `[ [0,'Foraxx'], [5,'Foraxx_HOO'], [7,'SHO'], [13,'HOO'], [14,'OHH'] ].forEach( ... )`
  against `FXStyles[i].id`, with a comment that new styles are appended, never inserted.

### Nit

#### N1. `fxSanitize`'s integer fallbacks duplicate the defaults as literals

- **Location:** `pjsr/lib/FXParameters.js:591-597`.
- **Evidence:** `clampInt( FX.sideBarWidth, 400, 1400, 560 )` and
  `clampInt( FX.histogramHeight, 200, 600, 220 )` repeat the values declared at
  lines 339-340, and `clampInt( FX.normalizeRef, 0, 2, 1 )` repeats line 257. The ranged loop
  immediately below correctly uses `FXDefaults[name]`.
- **Fix:** pass `FXDefaults.sideBarWidth`, `FXDefaults.histogramHeight`,
  `FXDefaults.normalizeRef`.

#### N2. The style-id uniqueness check in the test is dead code

- **Location:** `tests/parameters.test.js:115` (`const names = {}, ids = {};`) and `128`
  (`ids[s.id] = true;`).
- **Evidence:** `names` is read on line 119; `ids` is written and never read. Written as an
  assertion it would fail: `FXStyles[0]` and `FXStyles[1]` both carry `id: "Foraxx"`.
- **Why it matters:** it reads as a uniqueness guard and is not one. The duplicate is harmless
  — `fxUniqueBaseId` moves the whole group to `Foraxx01` — and is arguably right, since the two
  styles are the same palette with and without colour clean-up. The dead variable is the
  problem, not the duplicate.
- **Fix:** delete `ids`, or replace it with an explicit allowance:
  `ok( duplicates.length === 0 || duplicates.join() === 'Foraxx', ... )` with a comment saying
  why the pair shares a name.

#### N3. `fxReport` lives in the entry point but is called from the dialog, and reads the global `FX`

- **Location:** `pjsr/ForaxxPaletteStudio.js:279-344`; `pjsr/lib/FXDialog.js:1600`.
- **Evidence:** `fxReport( created, elapsed )` is defined in the entry script — where
  `docs/ARCHITECTURE.md` places it — but invoked from `FXDialog.runFinal`, i.e. a library calls
  a function defined in the file that includes it. It also reads the module-global `FX` rather
  than taking the parameter object, unlike `fxValidate( p )`, `fxRenderFinal( p )` and
  `fxBuildExpressions( p, ... )`. Both work because PJSR concatenates everything into one
  translation unit, and the harness only syntax-checks `FXDialog.js`, so neither would be
  caught.
- **Fix:** either move `fxReport` into `FXProcessing.js` next to the render it describes, or
  give it the signature `fxReport( p, created, elapsedMs )` and pass `FX` from the call site,
  so the report can never describe a different parameter set from the one that ran.

#### N4. Two spellings of "valid identifier"

- **Location:** `pjsr/lib/FXParameters.js:640` and `pjsr/lib/FXProcessing.js:1114` use
  `/^[A-Za-z_][A-Za-z0-9_]*$/`; `tests/parameters.test.js:126` uses `/^[A-Za-z][A-Za-z0-9_]*$/`.
- **Evidence:** the test forbids a leading underscore that both runtime checks allow. No
  current style id starts with one, so nothing fails.
- **Fix:** use the runtime regex in the test, or hoist one constant.

#### N5. The settings key is a `#define`, so the persistence layer cannot be driven by the harness

- **Location:** `pjsr/lib/FXParameters.js:558`; `tests/run.sh` (the `strip` function).
- **Evidence:** `strip()` removes every line beginning with `#`, so
  `#define FX_SETTINGS_KEY "ForaxxPaletteStudio/"` never reaches `tests/build/module.js` and
  `fxLoadSettings`/`fxSaveSettings` throw `ReferenceError` under node — swallowed by their own
  `try`/`catch`, which makes the failure look like an empty settings store. (Found by hitting
  it: my first probe reported every write as `undefined`.) This is a contributing cause of M5.
- **Fix:** make it a plain `var FX_SETTINGS_KEY = "ForaxxPaletteStudio/";` — nothing in the
  PixInsight build needs it to be a preprocessor symbol — or have `run.sh` translate simple
  `#define NAME "value"` lines into `var` declarations.

#### N6. A style's `values` set touches 14 of the ~40 parameters that change the output

- **Location:** `pjsr/lib/FXParameters.js:32-214`, `416-426`; `pjsr/lib/FXDialog.js:441-443`.
- **Evidence:** every style sets the same 14 keys (`gainSii/Ha/Oiii`, `blend`, `hardO`,
  `hardHO`, `curveStrength`, `satStrength`, `extraSaturation`, `posterLevels`,
  `starCleanGreen`, `scnrEnabled`, `scnrGreen`, `scnrMagenta`). It leaves untouched, among
  others, `normalizeEnabled` and its four amounts, `hdrEnabled` and its four amounts,
  `makeLuminance`/`lumApply` and the luminance levels, and all six starless/star levels — 27
  keys in total. `fxApplyStyle`'s comment states this ("Anything the style does not mention is
  left alone"), and `docs/ARCHITECTURE.md` conditions the frozen-output guarantee on *defaults*.
  The dialog tooltip does not: it says choosing an entry "sets the channel mapping, **every
  tuning slider** and the output image name at once" (`FXDialog.js:441-443`), and the first
  style is named "Foraxx - classic (starless identical to the original)" — a claim about the
  output, not about the 14 keys.
- **Why it matters:** selecting that style from a session with HDR switched on, normalization
  ticked or a black point left on the starless levels produces something that is not identical
  to the original, under a name that says it is. The user has to notice the section bars.
- **Fix:** the honest, cheap change is wording — "sets the channel mapping, the palette and
  colour sliders and the output image name"; and either rename the first style
  ("Foraxx - classic") or have it also clear the stages that would break the claim.

---

## Verification

Adversarial pass — each finding was attacked before being kept.

- **H1 — CONFIRMED.** Attempted refutation: *modern icons carry `paletteSchema`, so this never
  bites.* True for icons written by 2.5.0 and later — `fxExportParameters` writes every
  `FXPersisted` key including `paletteSchema`, and I verified a 2.5.0-2.7.0 icon (schema 2)
  migrates its `previewTarget` correctly. The finding is scoped to pre-2.5.0 icons, which
  exist by construction since 2.0.0 shipped process-icon support. Second attempt: *`fxSanitize`
  covers it anyway.* It covers the `blend` half only, because of the independent 3.0.1 rule; the
  `previewTarget` half is not covered, and I reproduced the wrong value (2 instead of 0). Kept
  at High: the promised mechanism does not run on that path at all, and the CHANGELOG says it
  does.
- **M1 — CONFIRMED, with the reachability caveat stated in the finding.** Attempted refutation:
  *`fxSanitize` guards `styleIndex`, so this is already handled.* It does, but it runs after the
  migrations, which the code comment says is required. Second attempt: *PixInsight's readers
  always return whole numbers.* Probably, for the settings path; I could not verify PJSR's
  behaviour on a malformed stored parameter, so the severity is Medium rather than High. The
  crash itself is reproduced, from both `NaN` and `7.5`.
- **M2 — CONFIRMED.** Attempted refutation: *resetting the schema is harmless because the
  migrations are idempotent.* `fxMigratePaletteBlend` is idempotent (it re-applies a rule
  `fxSanitize` applies unconditionally). `fxMigratePreviewTarget` is **not**: it re-interprets a
  legitimate current value (2 = luminance) as a retired one (2 = combined). Reproduced end to
  end through a mock store.
- **M3 — CORRECTED.** The invariant as given ("only a run accepted with Execute becomes the new
  stored default; closing with Close must leave previous settings alone") is **false**:
  `fxSaveSettings()` runs unconditionally in `main()` and again in `runFinal`. The code comment
  says so explicitly, so this is intended behaviour and not a bug — the entry is kept at Medium
  for the icon-clobbers-defaults consequence, which is a real and undisclosed side effect, not
  for the save-on-close itself.
- **M4 — CONFIRMED as a guard gap, not a live fault.** Attempted refutation: *the two tables
  agree today, so there is nothing to fix.* They do agree; I diffed them key by key. The finding
  is that neither the ordering nor the duplication is guarded, in the one area that has already
  produced a shipped bug (2.7.0).
- **M5 — CONFIRMED.** Verified directly against the `module.exports` block in `tests/run.sh`:
  none of `fxSanitize`, `fxMigrate*`, `fxLoadSettings`, `fxSaveSettings`, `fxImportParameters`,
  `fxApplyStyle`, `fxSetChannelCount` is exported, and no test file references them.
- **L1 — CONFIRMED.** Attempted refutation: *at `blend = 0` the masks cannot reach the output.*
  Correct for the colour images — `fxMix( a, b, 0 )` returns `b` verbatim
  (`FXExpressions.js:184-185`) — which is why this is Low and not High. But
  `fxRender` writes `e.o` and `e.ho` out as images whenever `opts.factors` is set, with no
  `dynamic` test (`FXProcessing.js:1227-1236`), and those two expressions carry `p.hardO` /
  `p.hardHO`. Second attempt: *the sliders are greyed, so the values can only be defaults.* They
  can also be whatever a settings file or icon restored — `fxSanitize` pins `blend` there and
  nothing else.
- **L2 — CONFIRMED but deliberately downgraded.** Reproduced (`"yes"` survives in eleven
  boolean keys), but only by feeding the loader a value PixInsight's typed reader would not
  produce. Defence in depth.
- **L3 — CONFIRMED.** Read the code against the comment twice; there is no "plausible zoom"
  test of any kind, and the rename documented at lines 331-334 makes the scenario unreachable.
- **L4 — CONFIRMED.** Constructed the counter-example mentally and checked every assertion in
  the block: nothing ties an index to a style identity.
- **N1, N4, N5 — CONFIRMED** by direct reading; N5 additionally by hitting the `ReferenceError`
  while building the probe harness.
- **N2 — CONFIRMED.** `ids` is written on line 128 and never read; the duplicate `"Foraxx"` id
  at `FXStyles[0]` and `FXStyles[1]` is real and, per `tests/naming.test.js`, harmless.
- **N3 — CONFIRMED** by grep: `fxReport` is defined only in `ForaxxPaletteStudio.js` and called
  only from `FXDialog.js:1600`.
- **N6 — CONFIRMED, downgraded to Nit.** Attempted refutation: *`ARCHITECTURE.md` says "at
  defaults", so the guarantee is correctly conditioned.* It does, and that is why this is not a
  Medium. What survives is the dialog tooltip's "every tuning slider", which is false (14 of
  ~40), and a style name that makes an unconditional claim about the output.
- **Checked and found sound — no finding raised:** every `p.<name>` / `FX.<name>` reference
  across the whole `pjsr/` tree resolves to a real `FX` key (no missing parameters); every
  non-view key is in `FXPersisted` (53 of 53, no duplicates, all types known and matching the
  live value); `paletteSchema` is the only persisted-but-never-read key, by design; every
  `FXRanges` name is real, persisted, non-empty, and contains its own default at its own
  precision (already guarded by the test); the three `high <= low + 0.001` resets cover all
  three level sets; `posterLevels == 1` is coerced to 2; `fxSanitize` leaves no non-finite
  number behind under a fully corrupt settings file; the 3.0.1 fixed-palette `blend = 0`
  invariant holds on both the settings and the icon path; `fxFirstStyleFor` returns a style
  compatible with the requested channel count in both directions; `fxSetChannelCount` correctly
  preserves a user-typed output name while replacing a stock one; and every conditional line in
  `fxReport` matches the corresponding gate in `FXProcessing` (`hdrEnabled`,
  `posterLevels >= 2`, `scnrEnabled`, `fxIsZero( lumApply )`, `makeStars`).
