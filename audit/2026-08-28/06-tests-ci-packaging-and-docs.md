# 06 — Tests, CI, packaging and docs

Audit date: 2026-08-28. Repo at `main` @ `64591ce`.

Scope: (A) `tests/run.sh`, `tests/shim.js`, `tests/assert.js`, the five `tests/*.test.js`
suites, `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
(B) `scripts/build-update-package.sh`, `scripts/stage-dev.sh`, `scripts/check-package.sh`,
`docs/RELEASING.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`,
`LICENSE`, `NOTICE.md`, `.gitattributes`, `.gitignore`, `.github/ISSUE_TEMPLATE/`.
`pjsr/` read only as far as needed to settle a claim.

Commands run: `bash tests/run.sh` (1262 assertions, green);
`bash scripts/build-update-package.sh 0.0.0-audit`; `bash scripts/check-package.sh dist/*.zip`
(PASS); nine mutation experiments against `pjsr/lib/*.js` and `tests/*.test.js`, each restored
immediately; a comparison of `tests/shim.js`'s `format()` against C `printf(1)`; a read of the
ingest contract in the update site's `scripts/build-update-repo.sh`; a read of the reference
repository the CaeloWorks PixInsight standards come from; and an inspection of an installed
PixInsight to settle the icon-path question.

---

## Executive summary

1. **The harness cannot report its own death.** Deleting the single `report( '…' )` line from a
   suite makes that suite's *failing* assertions vanish and the runner still prints
   `All tests passed`. Verified: with `report()` removed and a naming assertion deliberately
   broken, `tests/run.sh` exited 0 and announced "All tests passed (1204 assertions)". The only
   `process.exit(1)` in the whole harness lives in `assert.js:report`. `tests/run.sh:136-141`
   comments that surfacing the per-suite count is "the cheap guard against a suite that silently
   stops asserting" — it prints the number and never compares it to anything. **This is the single
   most important finding: every other test in this repo is only as trustworthy as this line.**

2. **The biggest coverage gap is `fxSanitize` and the three settings migrations — zero
   assertions, and free to add.** `fxSanitize`, `fxMigrateHdrEnabled`, `fxMigratePaletteBlend`,
   `fxMigratePreviewTarget`, `fxApplyStyle`, `fxSetChannelCount` and `fxValidate` are the entire
   defensive layer over every settings file and process icon in the field. None is in
   `tests/run.sh`'s `module.exports`. I proved all seven load and execute correctly under the
   *existing* shim with no new scaffolding — the gap costs about ten lines of `run.sh` plus a
   suite. 50 of the ~90 functions in the three bundled libraries are unexported and therefore
   unreachable by any assertion.

3. **A release can be published on a red CI.** `release.yml` is triggered by the tag push alone;
   it has no `needs:`, no `workflow_run` gate, and a tag push does not trigger `ci.yml` (which
   fires on `branches: [main]` and pull requests). `release.yml` re-runs `tests/run.sh` and
   `check-package.sh`, but **not** the `update-package.json` validator, **not** the reproducibility
   check, and **not** the entire `hygiene` job (shellcheck, SPDX headers, licence-file
   consistency, orphaned libs). The sidecar validator at `ci.yml:53-88` is the one guard on the
   `descriptionHtml` entity rule that protects *every* CaeloWorks script, and it does not run on
   the path that actually ships.

4. **Two assertions name an invariant they do not test, and I broke both while staying green.**
   `expressions.test.js:225` asserts "the HDR section off emits no expression" — but
   `fxBuildHDRCompression` never reads `hdrEnabled` at all (it returns a 383-character expression
   for `{hdrEnabled:false, hdrAmount:0.5}`); the test passes only because the default `hdrAmount`
   is 0. `expressions.test.js:240` guards the divide-by-luminance with
   `/Y <= 0\.0+1/.test(…) || expression.indexOf('iif(') >= 0`; I deleted the zero guard from the
   expression and the suite stayed fully green, because the outer `iif(` still satisfies the second
   disjunct.

5. **Packaging is the strongest part of the repo and I could not break it.** `check-package.sh`
   enforces every clause of the site's ingest contract I could find in
   `build-update-repo.sh`: `src/` prefix, `.xsgn` refusal, `__BUILD__` substitution, LICENSE and
   NOTICE.md presence, and — unusually good — a *whitelist* stray-file check rather than a
   blacklist, which is the right shape for an archive that unpacks over someone's PixInsight
   directory. `ci.yml`'s sidecar validator independently re-derives the SHA-1, checks all ten
   required fields, the `YYYYMMDD` and `piVersionRange` regexes, the undeclared-entity rule and
   the em-dash rule. The zip is genuinely deterministic within one environment. Permissions are
   `contents: read` on CI and `contents: write` only on the release job; no secret is ever echoed,
   and the signing password is read with `read -s` and never written to disk.

6. **The shim's `format()` diverges from C `printf` in four measured ways, and its own header
   says it must not.** Measured side by side: `%.6f` on 0.0078125 gives `0.007812` in C and
   `0.007813` in the shim; `%.2f` on 0.125 gives `0.12` vs `0.13`; `%.0e` on 1e-8 gives `1e-08`
   vs `1e-8`; `%.0f` on 2.5 gives `2` vs `3`. No current assertion sits on a divergent value, so
   nothing is wrong *today* — but `shim.js:7-10` states "the shim has to round exactly as C does —
   a shim that formatted differently would make the tests agree with themselves and with nothing
   else", and nothing pins the shim against a reference.

7. **Documentation is unusually accurate, with three real contradictions.** Of 38 README claims
   checked against `pjsr/`, 33 hold, 1 is unverifiable in-repo, and 3 fail (settings are saved on
   *every* close, not only on Execute; the linear-data warning is silently discarded whenever an
   HDR multiscale stage is on; and "switching to 2 channels moves a Sii palette to its Ha/Oiii
   equivalent" — repeated in a shipping tooltip — always lands on *Foraxx HOO dynamic* instead).
   `docs/ARCHITECTURE.md` is accurate on all the load-bearing claims (the expression forms, the
   slot-wise blending, the mask context, the naming group) and overstates on four small ones.

No Critical findings. Counts: High 5, Medium 10, Low 11, Nit 6.

---

## Findings

### High

#### H1. Removing `report()` from a suite hides every failure in it, and the runner still says "All tests passed"

- **Location:** `tests/assert.js:142-150`, `tests/run.sh:132-153`
- **Evidence:** `eq`/`ok`/`near` only increment a counter; the sole `process.exit( 1 )` in the
  harness is inside `report()`. A suite that never calls `report()` therefore exits 0 no matter
  how many assertions failed. Mutation run: I removed `report( 'naming' );` from
  `tests/naming.test.js` *and* changed one expected value to `'WRONG'`. Result:

  ```
  OK     actual:   "Foraxx01"
  All tests passed (1204 assertions).
  ```

  Exit code 0. The `FAIL` diagnostics went to stderr, were captured into
  `tests/build/last.log`, and were overwritten by the next suite. The runner's own comment at
  `tests/run.sh:136-138` claims the per-suite count is "the cheap guard against a suite that
  silently stops asserting" — the count dropped from 1262 to 1204 and nothing compared it.
- **Why it matters:** This is the failure mode most likely to arise from an ordinary edit
  (refactoring a suite, splitting one in two, a bad merge). It converts the entire 1262-assertion
  harness — which `release.yml` treats as the gate on shipping — into a rubber stamp, silently.
- **Fix:** Two independent guards, both cheap.
  1. In `assert.js`, register `process.on( 'exit', … )` that fails the process if `report()` was
     never called or if `failed > 0`, so a missing `report()` becomes a hard error rather than a
     free pass.
  2. In `tests/run.sh`, require each suite to yield a parseable count and fail if it does not,
     and assert a floor on the total:
     ```sh
     [ -n "$n" ] && [ "$n" -gt 0 ] || { echo "FAIL $(basename "$t") reported no assertion count"; failures=1; }
     ...
     MIN_ASSERTIONS=1200
     [ "$total" -ge "$MIN_ASSERTIONS" ] || { echo "assertion count collapsed: $total < $MIN_ASSERTIONS" >&2; exit 1; }
     ```
     Bump the floor deliberately, the way the CHANGELOG already quotes the number.

#### H2. The entire settings/process-icon defensive layer has no test, and is free to test

- **Location:** `tests/run.sh:63-119` (the `module.exports` block); `pjsr/lib/FXParameters.js:565-644`
  (`fxSanitize`), `:654-692` (the three migrations), `:416-453` (`fxApplyStyle`,
  `fxSetChannelCount`); `pjsr/lib/FXProcessing.js:1064` (`fxValidate`)
- **Evidence:** 50 of the ~90 `fx*` functions defined in the three bundled libraries are not in
  `module.exports` and so cannot be reached by any assertion. Most are genuinely PI-facing, but
  these seven are not. `fxSanitize` alone encodes eleven distinct repair rules — style-index
  fallback, `previewScale` migration from a pre-2.3.1 step index, four `clampInt` bounds, a loop
  over all 32 `FXRanges` entries, `posterLevels == 1 → 2`, three black-above-white resets, the
  `blend = 0` hold on fixed palettes, and an identifier regex. The three migrations each perform a
  one-shot, irreversible transformation on a real user's stored data.
  `CONTRIBUTING.md:170-171` makes this an explicit house rule ("Settings migrate. People have
  process icons").

  I confirmed the gap is free to close: re-exporting these seven from the already-built
  `tests/build/module.js` and driving them under the *existing* shim works with no new
  scaffolding. Feeding `fxSanitize` a corrupt object
  (`styleIndex:999, gainSii:1e9, baseId:'9bad-id', previewScale:NaN, levelsLow:0.9, levelsHigh:0,
  posterLevels:1`) returned `styleIndex:0, gainSii:3, baseId:'Foraxx', previewScale:1,
  levelsLow:0, levelsHigh:1, posterLevels:2`, and `fxMigratePreviewTarget` correctly mapped a
  stored `3` to `2` and stamped `paletteSchema:3`. `fxValidate` also loads under the shim.
- **Why it matters:** These functions run on every launch, for every user, on data written by a
  version of the script that no longer exists. A regression here does not crash — it silently
  changes somebody's stored palette, or drops a value, which is exactly the class of fault
  `parameters.test.js`'s own preamble says is "invisible until a user complains".
- **Fix:** Add to `tests/run.sh`'s exports: `fxSanitize`, `fxMigrateHdrEnabled`,
  `fxMigratePaletteBlend`, `fxMigratePreviewTarget`, `fxApplyStyle`, `fxSetChannelCount`,
  `fxResetAllLevels`, `fxLevelsInForceElsewhere`, `fxDefaultOf`. Add `tests/settings.test.js`
  covering: every `fxSanitize` repair rule with an out-of-range and a `NaN` input; the
  `paletteSchema` ratchet (each migration is idempotent and runs exactly once); the
  `previewTarget 3→2, 2→0` mapping *and* the ordering constraint that
  `FXParameters.js:683-692` documents (`fxMigratePreviewTarget` must run before `fxSanitize`, or
  the clamp collapses 3 onto 2); `fxMigrateHdrEnabled( false )` adopting the old amounts; and
  `fxSetChannelCount( true )` preserving a user-typed `baseId` but replacing a stock one.

#### H3. `expressions.test.js` asserts an HDR gate that `fxBuildHDRCompression` does not implement

- **Location:** `tests/expressions.test.js:224-229`; `pjsr/lib/FXExpressions.js:377-380`
- **Evidence:** The test reads:
  ```js
  eq( fx.fxBuildHDRCompression( P( { hdrEnabled: false } ) ), null,
      'the HDR section off emits no expression' );
  ```
  `fxBuildHDRCompression` never reads `p.hdrEnabled`; its only guard is
  `if ( fxIsZero( p.hdrAmount ) ) return null;`. The test passes because the *default*
  `hdrAmount` is 0, not because the section flag was honoured. Driven directly:
  `fxBuildHDRCompression({hdrEnabled:false, hdrAmount:0.5, hdrKnee:0.6})` returns a
  383-character expression. The real gate lives at `pjsr/lib/FXProcessing.js:1243` and `:1267`
  (`if ( p.hdrEnabled )`), inside `fxRenderParts`, which is unexported and unreachable by the
  harness. The symmetric line at `:228` (`P({hdrEnabled:true, hdrAmount:0.5, …})`) is likewise
  passing an argument the function ignores.
- **Why it matters:** `CHANGELOG.md` records 2.3.3 as the release that made HDR a switched
  section "precisely so that nothing in it runs unless it is asked for", and this test is dressed
  as the guard on that. Deleting `if ( p.hdrEnabled )` from `FXProcessing.js:1243` would make
  every user with a non-zero stored `hdrAmount` and the section switched off silently get HDR
  compression again — and the suite would stay green.
- **Fix:** Either (a) move the gate into the builder — `if ( !p.hdrEnabled || fxIsZero( p.hdrAmount ) ) return null;` — which makes the existing assertion honest and puts the invariant
  where a test can see it; or (b) rename the assertion to what it actually checks
  ("a zero amount emits no expression"), export enough of `fxRenderParts`' stage selection to
  test the real gate, and add a test that `{hdrEnabled:false, hdrAmount:0.5}` still yields no HDR
  stage. (a) is much the cheaper of the two and matches how `posterLevels` and `starStretch`
  already self-gate.

#### H4. `release.yml` publishes without any dependency on CI, skipping the sidecar validator and the whole hygiene job

- **Location:** `.github/workflows/release.yml:148-193`; `.github/workflows/ci.yml:3-7, 53-88, 95-143`
- **Evidence:** `release.yml` triggers on `push: tags: ['v*']`. `ci.yml` triggers on
  `push: branches: [main]` and `pull_request` — a tag push matches neither, so **CI does not run
  for the release commit**, and `release.yml` declares no `needs:` and no `workflow_run` gate.
  The release job re-runs `tests/run.sh` and `scripts/check-package.sh`, but not:
  - the `update-package.json` validator (`ci.yml:53-88`) — the SHA-1 cross-check, the ten
    required fields, the `YYYYMMDD` and `piVersionRange` regexes, the undeclared-HTML-entity
    check and the em-dash check;
  - the reproducibility check (`ci.yml:44-51`);
  - the entire `hygiene` job — shellcheck, the SVG well-formedness parse, the orphaned-lib check,
    the SPDX header check, and the LICENSE/NOTICE.md consistency check (`ci.yml:95-143`).

  `docs/RELEASING.md:51-52` mitigates this by procedure ("push `main` first, then tag ... so CI on
  `main` has run before the tag exists") — but nothing enforces it, nothing checks the result, and
  the em-dash/entity rule is the one whose failure mode is *repository-wide*.
- **Why it matters:** `build-update-repo.sh:96-103, 227-233` shows the blast radius: an
  undeclared entity in `descriptionHtml` makes `updates.xri` malformed and PixInsight rejects the
  **whole** CaeloWorks repository, not just this package. The site does have a `normalize_desc`
  pass and a final `minidom` parse, so the realistic outcome is that the shared index build
  *refuses to ship anything* rather than shipping something broken — bad, but caught downstream.
  The uncaught cases are the ones the site does not re-derive: a lib file that lost its SPDX
  header, an orphaned `#include`, a shellcheck regression in the release scripts themselves.
- **Fix:** Make the release depend on the same gates. Either add the tag to `ci.yml`'s triggers
  (`push: { branches: [main], tags: ['v*'] }`) and gate `release.yml` on it with
  `workflow_run`, or — simpler and self-contained — lift the sidecar validator and the hygiene
  checks into a reusable workflow (`.github/workflows/checks.yml`) called by both via
  `workflow_call`. At minimum, copy the `Sidecar matches the built zip` step verbatim into
  `release.yml` between the build and the publish.

#### H5. A `real` → `int` downgrade in `FXPersisted` passes green for any parameter whose default is a whole number

- **Location:** `tests/parameters.test.js:112-113`; `pjsr/lib/FXParameters.js:461-516, 752`
- **Evidence:** The type check is
  ```js
  if ( type === 'int' )
     eq( v, Math.round( v ), name + ' is stored as int and holds a whole number' );
  ```
  It compares the *default value* against its own rounding, so it only fires for parameters whose
  default is fractional. Mutation: changing `[ "blend", "real" ]` to `[ "blend", "int" ]` left the
  suite green and *added* an assertion — `All tests passed (1263 assertions)`. The same mutation
  on `normShadow` (default 0.25) was caught. The parameters this hole covers are `blend`, the
  three gains, `curveStrength`, `satStrength`, `starStretch`, `lumHigh`, `levelsHigh` and
  `starLevelsHigh` — ten of the 53 persisted keys, all defaulting to 0.00 or 1.00.
- **Why it matters:** `fxSaveSettings` (`FXParameters.js:752`) writes an `int` entry as
  `Settings.write( …, DataType_Int32, Math.round( FX[name] ) )`. A `blend` of 0.65 would be
  written back as 1 on every session close, and read back as full dynamic Foraxx. There is no
  crash and no warning; the user's tuning quietly snaps to the nearest integer.
- **Fix:** Assert the *declared type against the parameter's range and precision*, not against
  the default's happenstance value. `FXRanges` already carries the decimals:
  ```js
  const r = fx.FXRanges[name];
  if ( r ) eq( type, r[2] === 0 ? 'int' : 'real', name + ' persistence type matches its slider precision' );
  ```
  That covers 32 of the 53 keys exactly and would have caught the mutation.

---

### Medium

#### M1. `tests/shim.js`'s `format()` diverges from C `printf` in four measured ways, contradicting its own contract

- **Location:** `tests/shim.js:7-48`
- **Evidence:** Measured against `printf(1)` on this machine:

  | call | C `printf` | `tests/shim.js` |
  |---|---|---|
  | `%.6f` of `0.0078125` | `0.007812` | `0.007813` |
  | `%.2f` of `0.125` | `0.12` | `0.13` |
  | `%.0f` of `0.5` / `2.5` | `0` / `2` | `1` / `3` |
  | `%.0e` of `1e-8` | `1e-08` | `1e-8` |
  | `%.3e` of `3.4e-5` | `3.400e-05` | `3.400e-5` |

  Two root causes: JavaScript's `toFixed` rounds ties away from zero where C rounds half-to-even
  on the exact binary value, and `toExponential` emits a one-digit exponent where C pads to two.
  `%d` is implemented as `Math.round`, which rounds 2.5 to 3. `%%` is not handled at all
  (`"%%d"` would consume an argument). The shim's own header (`:7-10`) says "the shim has to round
  exactly as C does — a shim that formatted differently would make the tests agree with themselves
  and with nothing else."
- **Why it matters:** The tie cases are reachable: `fxBuildStarStretchExpression`
  (`FXExpressions.js:313`) emits `format( "%.2f", k )` for `starStretch`, restored verbatim from a
  process icon, so a stored 0.125 produces `3^0.12` in PixInsight and `3^0.13` under the harness.
  `fxNum` (`:92`) emits `format( "%.6f", v )` for every constant in the ordinary range. Neither
  divergence bites today — I checked every literal the suites pin, and none is a tie — but the
  harness has no way of noticing when one starts to.
- **Fix:** Pin the shim itself. Add `tests/shim.test.js` with a table of ~20 `(fmt, value,
  expected)` triples generated once from C `printf` (dyadic ties, negative zero-padding, small
  exponents, `%%`, `%02d`) and assert `format()` reproduces them. Then fix the divergences:
  implement `%e` by post-processing `toExponential` to two-digit exponents, and use a
  round-half-to-even helper for `%f` and `%d`. Where PixInsight's own behaviour is genuinely
  unknown (`%d` with a non-integer), say so in the comment rather than asserting C semantics.

#### M2. The HDR divide-by-luminance guard is asserted with `A || B`, and B is always true

- **Location:** `tests/expressions.test.js:240-241`; `pjsr/lib/FXExpressions.js:402`
- **Evidence:**
  ```js
  ok( /Y <= 0\.0+1/.test( e.expression ) || e.expression.indexOf( 'iif(' ) >= 0,
      'the division by luminance is guarded against zero' );
  ```
  The expression is `s = iif(hi, iif(Y <= 0.0000000001, 1, Yc/Y), 1);`. I replaced it with
  `s = iif(hi, Yc/Y, 1);` — removing the zero guard entirely — and the suite stayed fully green
  (`All tests passed (1262 assertions)`), because the outer `iif(` still satisfies the second
  disjunct.
- **Why it matters:** Without the guard, a pure-black pixel above the knee divides by zero and
  the HDR stage writes `NaN` into the image. The assertion is presented as the guard on that and
  cannot fail short of removing every `iif` from the expression.
- **Fix:** Drop the disjunction and assert the guard directly:
  `ok( /iif\(\s*Y <= 0\.0+1\s*,\s*1\s*,\s*Yc\/Y\s*\)/.test( e.expression ), … )`. Better still,
  evaluate the emitted expression at `Y = 0` the way the star-stretch and MTF tests already do
  (`expressions.test.js:180-182`, `emission.test.js:339`) and assert the result is finite — a
  behavioural check rather than a string match.

#### M3. An `#include` naming a file that does not exist is caught by nothing

- **Location:** `tests/run.sh:50-52` (`strip`), `.github/workflows/ci.yml:109-120`
- **Evidence:** `strip()` deletes every preprocessor directive rather than resolving it, so the
  harness never sees an include at all. I added `#include "lib/FXHelpers.js"` — a file that has
  never existed — to `pjsr/ForaxxPaletteStudio.js`. `bash tests/run.sh` printed
  `All tests passed (1262 assertions)`, and the CI orphan check exited 0 (it only walks
  `pjsr/lib/*.js` and asks whether each *existing* file is included; it never asks whether each
  include resolves). `check-package.sh` has nothing to say either. PixInsight's preprocessor
  would abort on the first run.

  The related mutation — repointing an existing include at a nonexistent file — *is* caught, but
  only as a side effect: the real lib then becomes an orphan and `ci.yml:117` fires.
- **Why it matters:** The one class of fault the preprocessor makes fatal is the one class the
  harness is structurally blind to, and `docs/RELEASING.md:3-4` describes `tests/run.sh` as a
  "syntax check of every PJSR file".
- **Fix:** Add the reverse check next to the orphan check in `ci.yml`, or better, in `run.sh`
  where contributors see it:
  ```sh
  grep -hoE '#include "[^"]+"' pjsr/ForaxxPaletteStudio.js pjsr/lib/*.js \
    | sed 's/.*"\(.*\)"/\1/' | sort -u | while read -r inc; do
       [ -f "pjsr/$inc" ] || [ -f "pjsr/lib/$inc" ] || { echo "::error::#include \"$inc\" resolves to nothing"; exit 1; }
    done
  ```

#### M4. A suite that asserts nothing is reported as `OK` and counted as zero

- **Location:** `tests/run.sh:134-147`
- **Evidence:** I dropped `tests/zzz.test.js` containing only `'use strict';` and a comment.
  Output: `OK   ` followed by `All tests passed (1262 assertions).`, exit 0. `CONTRIBUTING.md:139-141`
  invites exactly this ("Add a suite by dropping `tests/<name>.test.js` next to the others"), so
  a new contributor's half-written suite reports green from the first commit.
- **Why it matters:** Same class as H1, lower probability. It also means the `n=0` fallback at
  `run.sh:139` (`|| echo 0`) silently absorbs any suite whose output format changes.
- **Fix:** Same as H1's guard 1 — require every suite to report a non-zero count.

#### M5. `node --check` is not PJSR's grammar, and `#define` bodies are deleted rather than expanded

- **Location:** `tests/run.sh:50-52, 122-130`
- **Evidence:** `strip()` removes `#define VERSION "__BUILD__"`,
  `#define FX_SETTINGS_KEY "ForaxxPaletteStudio/"` and `#define FX_TEMP_PREFIX "FXtmp_"`, so the
  identifiers those macros supply are simply undefined in `tests/build/module.js` and in each
  `check-*.js`. `node --check` only parses, so nothing notices. It follows that the harness never
  parses the text PixInsight actually compiles: a `#define` whose expansion is syntactically
  invalid, or a misspelled macro at a use site, is invisible. Separately, Node's parser accepts a
  strictly larger grammar than PJSR's legacy engine, and `docs/ARCHITECTURE.md:87-91` is explicit
  that this script deliberately does **not** declare `#engine v8`. (The sources are conservative —
  zero arrow functions, no template literals, no `class`, only `let`/`const` — so nothing is
  broken today.)
- **Why it matters:** `docs/RELEASING.md:3-4` and `CONTRIBUTING.md:114` both describe this step
  as a "syntax check of every PJSR file", which overstates what it can prove.
- **Fix:** Cheap: make `strip()` *apply* simple object-like `#define NAME value` substitutions
  instead of deleting them, which both removes the undefined identifiers and exercises the
  expansions. Then soften the wording in `RELEASING.md` and `CONTRIBUTING.md` to "parsed by Node,
  which is a superset of PJSR's grammar — it catches broken syntax, not PJSR-specific
  incompatibility."

#### M6. The Node matrix tests nothing distinct

- **Location:** `.github/workflows/ci.yml:16-23`
- **Evidence:** `node: ['22', '24']`. The comment says the matrix is "about catching a suite that
  depends on one runtime's behaviour". Nothing in the harness or the sources touches an area where
  Node 22 and Node 24 differ: the suites use `Object.assign`, `findIndex`, `Set`, `padStart` and
  arrow functions, all stable since Node 12; the bundled sources are ES5-plus-`let`. Both runs
  produce identical output.
- **Why it matters:** It doubles the CI minutes and the surface for a flaky run in exchange for
  no signal, and it reads as coverage that is not there. The runtime that actually matters —
  PixInsight's — is tested by neither leg.
- **Fix:** Drop to a single Node version and say plainly in the comment that PJSR's engine is not
  covered by CI and is covered by the hand gates in `docs/RELEASING.md`. If a second leg is wanted
  for insurance, pin the *oldest* Node still in support rather than two adjacent currents, since
  that is the direction in which a syntax surprise would appear.

#### M7. Several `check-package.sh` assertions verify the builder against itself

- **Location:** `scripts/check-package.sh:150-151, 179-189`
- **Evidence:** `NAME` and `VENDOR` are re-declared as literals identical to
  `build-update-package.sh:19, 30`. The icon check
  (`has "rsc/icons/script/$NAME/$NAME.svg"`) and the vendor-path checks therefore assert that the
  builder put the file where the builder was told to put it. Neither is derived from the thing
  they are supposed to protect — the `#feature-icon @script_icons_dir/ForaxxPaletteStudio.svg`
  declaration at `pjsr/ForaxxPaletteStudio.js:251`, and the `#include "lib/…"` paths. The lib
  loop at `:180` is the one check with an independent source (`ls pjsr/lib`), and it is
  correspondingly the most useful; note it checks only that each lib is *present*, never that
  nothing *extra* was swept in by `cp -R "$REPO"/pjsr/lib/.`.
- **Why it matters:** Renaming the SVG on both sides at once, or moving the vendor directory in
  both scripts, passes. The check reads as an independent gate and is not one.
- **Fix:** Derive the icon path from the script: parse `#feature-icon` out of
  `pjsr/ForaxxPaletteStudio.js`, expand `@script_icons_dir` to `rsc/icons/script/<NAME>`, and
  check *that* path is in the zip. Add the inverse of the lib loop — every
  `$VENDOR/lib/*` entry in the zip must correspond to a file in `pjsr/lib/`.

#### M8. README's linear-data warning claim fails whenever an HDR multiscale stage is on

- **Location:** `README.md:34-35` and `README.md:572`; `pjsr/lib/FXDialog.js:338-360`
- **Evidence:** The status-line builder appends with `+=` on lines 345, 348 and 358, but line 351
  **assigns**:
  ```js
  if ( FX.hdrEnabled && (FX.hdrLayers > 0 || FX.localContrast > 0) )
     note = "  -  multiscale stages are approximate at this sampling";
  ```
  So with `hdrEnabled` and either `hdrLayers > 0` or `localContrast > 0`, both the capitalised
  `THESE CHANNELS LOOK LINEAR` warning (`:348-350`) and the `levels also in force on: …` note
  (`:343-345`) are discarded. README:34-35 states "The status line under the preview tells you, in
  capitals, if the channels you selected look linear"; README:572 states "If a set is in force on
  an image you are not currently looking at, the status line says so". Both fail in that state.
- **Why it matters:** The linear-data banner is the script's primary safety net — the file header,
  the `#feature-info`, the README's boxed warning and `CONTRIBUTING.md:105-108` all point at it —
  and it is suppressed by an unrelated checkbox.
- **Fix:** Change `note =` to `note +=` at `FXDialog.js:351`. The underlying code fault belongs to
  the `pjsr/` audit; recorded here because it is a documentation claim that does not hold. Add a
  status-line composition test once `fxLevelsInForceElsewhere` is exported (see H2) — the three
  note contributions are pure string logic and are testable independently of the dialog.

#### M9. "Switching to 2 channels moves a Sii palette to its Ha/Oiii equivalent" is false, and the test that exists pins a weaker property

- **Location:** `README.md:421`; the shipping tooltip at `pjsr/lib/FXDialog.js:406-407`;
  `pjsr/lib/FXParameters.js:227-233, 439-453`; `tests/parameters.test.js:225-226`
- **Evidence:** `fxSetChannelCount( true )` calls `fxApplyStyle( fxFirstStyleFor( true ) )`, and
  `fxFirstStyleFor` returns the *first* entry in `FXStyles` with `needsSii == false` — index 5,
  `"Foraxx HOO - dynamic, Ha and Oiii only"` (confirmed by driving it). A user on fixed **SHO
  (Hubble)** therefore lands on *dynamic Foraxx HOO*, not on the fixed **HOO (bicolour)** that is
  its equivalent, and `fxApplyStyle` overwrites all fourteen tuning values on the way. The
  tooltip the user actually reads says "If a Sii palette is selected when you choose this, it
  moves to the Ha / Oiii equivalent." The one assertion that touches this function,
  `parameters.test.js:225`, checks only
  `ok( !fx.FXStyles[ fx.fxFirstStyleFor( true ) ].needsSii, … )` — true of any two-channel style,
  so it can never catch the documented promise being broken.
  (The README occurrence is inside the collapsed *Previously, in 2.2.0* block, so it is
  arguably historical; the tooltip is not.)
- **Why it matters:** A user switching channel count silently loses every slider they set, and
  the interface told them something else would happen. It is also a good illustration of a test
  that pins the implementation's weakest observable property rather than the contract.
- **Fix:** Decide which is true and align the other. If the promise is right, `fxFirstStyleFor`
  should prefer a style with the same `dynamic` flag and, failing that, the same `id` stem — and
  the test should assert `fxSetChannelCount(true)` from fixed SHO lands on fixed HOO. If the
  current behaviour is right, reword the tooltip to "moves to the first Ha / Oiii palette, which
  resets the tuning sliders".

#### M10. "Only a run you accept with Execute becomes the new stored default" is false

- **Location:** `README.md:657-658`; `pjsr/ForaxxPaletteStudio.js:370-375`
- **Evidence:**
  ```js
  dialog.execute();
  // Whatever happened in there, the settings the user left behind are the
  // ones they want next time - a session spent tuning and then closed without
  // an Execute must not be thrown away.
  fxSaveSettings();
  ```
  `fxSaveSettings()` is called unconditionally after `execute()` returns, whichever button ended
  the dialog. Execute also saves (`FXDialog.js:1601`), so Execute is not the gate at all — every
  close persists the current settings. The source comment states the opposite design intent to
  the README, which suggests the README is the stale half.
- **Why it matters:** A user who opens the dialog, experiments, decides against it and presses
  Close has been told their previous settings survive. They do not.
- **Fix:** Correct README:657-658 to match the code and the comment: "Settings persist on close,
  whether or not you ran Execute — a session spent tuning is never thrown away. Use the per-slider
  reset buttons or **New Instance** if you want to keep a known-good set." If the README's
  behaviour is the intended one, gate `fxSaveSettings()` on `dialog.didRun` instead.

---

### Low

#### L1. `docs/ARCHITECTURE.md:66-68` says "Fixed notation, six decimals" and omits the twelve-decimal branch

`fxNum` (`FXExpressions.js:89-92`) switches to `FX_NUM_DECIMALS = 12` for magnitudes below 1e-4 —
the branch `emission.test.js:284-285` pins literally (`fxNum(1e-5) === '0.000010000000'`) and the
one the CHANGELOG credits with fixing the 2.3.4 black-nebula fault. The map sends a contributor
to the wrong mental model of the very function it names. Fix: "Fixed notation. Six decimals in the
ordinary range; twelve below 1e-4, so a solved balance down to `FX_MTF_MIN` keeps four significant
figures."

#### L2. `docs/ARCHITECTURE.md:77` "Always 32-bit floating point" overstates twice

`fxSampleFormat32` (`FXProcessing.js:492-500`) returns `PixelMath.prototype.f32` **only if it is
defined**, and falls back to `SameAsTarget` otherwise — a live path, since the README supports
PixInsight back to 1.8.9. It is also read at exactly one call site (`:539`, `fxPixelMathNew`);
`fxPixelMathInPlace` (`:547`) never sets a sample format. README:659-660 carries the same claim.
Fix: "32-bit floating point for every image the pipeline creates, where the platform exposes
`PixelMath.prototype.f32`."

#### L3. `docs/ARCHITECTURE.md:3-6` "no pixel arithmetic in JavaScript anywhere"

`FXHistogram.js:56-62` walks the image on a strided grid calling `image.sample( x, y, k )` and
bins the values in JavaScript. The sentence is defensible in context — it is about what the script
*produces*, and the histogram is a display widget — but "anywhere" is stronger than the code
supports. Fix: "…no pixel arithmetic in JavaScript anywhere in the render path (the histogram
widget samples pixels to draw itself, and produces nothing)."

#### L4. `docs/ARCHITECTURE.md:68` "Never reach for `%e`"

`FXProcessing.js:135-137` uses both `%.3e` and `%.0e`. The rule is clearly about *numeric emission
into PixelMath expressions*, where it holds absolutely, and those two are console warning text —
but the flat imperative reads as a codebase-wide ban that the codebase does not honour. Fix:
scope it: "Never reach for `%e` **in an expression literal**."

#### L5. `CONTRIBUTING.md:159` and `NOTICE.md:24` name a palette that does not exist

Both say *Foraxx — dynamic SHO*; `docs/ARCHITECTURE.md:38`, `README.md:23-26` and
`FXStyles[0].name` say *Foraxx - classic*. `NOTICE.md` is part of the licence terms and ships
inside the zip, so it is the copy most worth getting right. Fix: use the string from
`FXStyles[0].name` in all four places.

#### L6. `docs/RELEASING.md` contradicts itself on whether a version is kept by hand

`:71-74` states "There is no version number to keep in step by hand and no way for the zip name and
the dialog to disagree." `:37-38` instructs "Update the README version badge", and `README.md:7`
hardcodes `version-3.0.1`. The `__BUILD__` mechanism is genuinely good and genuinely covers the
zip and the dialog; the badge is a third, manual copy. Fix: either drop the sentence's absolute
form, or drop the version from the badge (link the Releases page and let it say "latest").

#### L7. `tests/parameters.test.js:206` collects `ids` and never asserts on it

`ids[s.id] = true;` populates a map that nothing reads — the residue of a uniqueness assertion
that was written and removed, or intended and forgotten. Note that output ids are in fact *not*
unique (styles 0 and 1 both use `"Foraxx"`), which is deliberate, so the missing assertion cannot
simply be reinstated. Fix: delete the dead variable, and add the assertion that is actually wanted
— that every `id` matches the PixInsight identifier regex, which `:204` already does.

#### L8. `release.yml` interpolates the tag name straight into a shell script

`:175` (`v="${{ steps.v.outputs.version }}"`) and `:180`
(`bash scripts/build-update-package.sh "${{ steps.v.outputs.version }}"`) substitute a
GitHub expression into `run:` before the shell sees it. Git ref names permit `"`, `;`, `$` and
backticks, so a tag such as `v1.0.0";curl …|sh;"` executes. Only users with push access can create
a tag, so the practical risk is low, but it is the pattern GitHub's own hardening guidance calls
out. Fix: pass through the environment — `env: { VERSION: "${{ steps.v.outputs.version }}" }` and
use `"$VERSION"` in the script.

#### L9. Actions are pinned to floating major tags

`actions/checkout@v5`, `actions/setup-node@v5`, `actions/upload-artifact@v5`. For a workflow that
holds `contents: write` and publishes the artifact the shared update repository ingests by SHA-1,
pinning to a commit SHA (with the tag in a trailing comment) is the standard hardening. Fix: pin
SHAs and let Dependabot bump them.

#### L10. The README credit section omits two of the five upstream attributions

`README.md:668-684` credits Godingen, Hancock, Blanshan and Pleiades. It does not name
**Franklin Marek / SetiAstro** — whose CC BY-NC 4.0 work is, per `NOTICE.md:29-34`, "the licence
that sets the NonCommercial condition on the whole of Foraxx Palette Studio" — nor **Mike
Cranfield**. This is not a licence breach: the obligation is discharged by
`ForaxxPaletteStudio.js:26-48` and by `NOTICE.md`, both of which ship inside the zip. But the
project's front page omits the attribution that binds the whole project. Fix: add both to the
README credit section, mirroring `NOTICE.md`.

#### L11. The reproducibility check cannot see the only variance that would matter

`ci.yml:44-51` builds twice on the same runner in the same job. The zip's `create_system` field is
`3` (Unix) here and would be `0` on a Windows builder, changing the central directory and the
SHA-1; `zipfile`'s default deflate level is likewise environment-dependent. Note this is a
*reproducibility* concern, not a contract violation — the site verifies the published sidecar's
SHA-1 against the published zip, which is the same artifact — so the check's real value is
catching accidental entropy (mtimes, walk order), which it does. Fix: set
`zi.create_system = 3` and `compresslevel=9` explicitly in `build-update-package.sh:105-108`,
and reword the CI step so it does not promise more than same-runner determinism.

---

### Nit

- **N1.** `tests/expressions.test.js:129-130`:
  `ok( neutral.o.indexOf( '*' ) < 0 || neutral.o === '(Oiii)^~(Oiii)', … )`. The first disjunct is
  always true for the correct output, so the second never runs; and any wrong output without a `*`
  would pass. The invariant *is* covered — by the literal pin at `:33`, which a mutation confirmed
  catches — so this line is redundant rather than harmful. Drop it or make it an `eq`.
- **N2.** `scripts/check-package.sh:158`: `grep -qx "$1"` treats the argument as a basic regular
  expression, so `.` in `FXDialog.js` matches any character. Use `grep -qxF`.
- **N3.** `scripts/build-update-package.sh:106`: `perm = 0o755 if "/bin/" in ("/" + arc)` — this
  package has no `bin/` tree and, being `type: script`, never will. Harmless copy from the module
  variant of the builder; worth a comment saying so, or removing.
- **N4.** `tests/normalization.test.js:24`: `near( fx.fxMTFValue( 0, 0.4 ), 0.4 / (0.4 + 0), … )`.
  The expected value is `1` written as a division whose denominator is the numerator. It is
  correct, but it obscures what is being asserted; write `1`.
- **N5.** `dist/` appears in both `.gitignore:1` and `.git/info/exclude`. Harmless duplication.
- **N6.** `fxUniqueViewId` carries four assertions in `naming.test.js:15-28` but has exactly one
  caller (`FXPreview.js:472`), for hidden `FXtmp_` working images the user never sees. The
  user-visible naming promise is `fxUniqueBaseId`'s, which is also well covered. Not wrong, just
  disproportionate.

---

## Coverage gaps — invariants with no test

| Invariant | Where it lives | Why it matters | How to test it |
|---|---|---|---|
| **A corrupt or out-of-range settings value is repaired, not propagated** (11 distinct rules) | `FXParameters.js:565-644` `fxSanitize` | Runs on every launch against data written by versions that no longer exist. A regression silently changes a stored palette. | Export `fxSanitize`; feed it out-of-range, `NaN`, wrong-type and hostile values for each of the 11 rules and assert the repaired result. Loads under the existing shim — verified. |
| **Each schema migration runs exactly once and is idempotent** | `FXParameters.js:654-692` (`fxMigrateHdrEnabled`, `fxMigratePaletteBlend`, `fxMigratePreviewTarget`) | One-shot irreversible transformations on real users' stored data. `paletteSchema` is the only thing stopping a double application. | Export all three; assert `previewTarget 3→2`, `2→0`, `paletteSchema` ratchets to 3, and a second call is a no-op. |
| **`fxMigratePreviewTarget` runs *before* `fxSanitize`** | `FXParameters.js:683-692` (comment), `:732-735`, `:799-802` | The comment says if the order flips, the clamp collapses stored `3` onto `2` and the two become indistinguishable. Nothing enforces the order. | Assert that `fxSanitize` first, then the migration, gives a different (wrong) answer than the shipped order — pins the ordering as a contract. |
| **The HDR section flag actually gates the HDR stages** | `FXProcessing.js:1243, 1267` | `expressions.test.js:225` claims to test this and does not (H3). Removing the gate silently re-enables HDR for anyone with a stored non-zero amount. | Move the gate into `fxBuildHDRCompression` (H3 fix (a)), then the existing assertion becomes true. |
| **Every `#include` resolves to a file that exists** | `pjsr/ForaxxPaletteStudio.js:270-271`, `pjsr/lib/*.js` | The preprocessor makes this fatal; the harness is structurally blind to it (M3, verified). | Grep-and-resolve loop in `run.sh` (M3 fix). |
| **The persistence type of a parameter matches its slider precision** | `FXParameters.js:461-516` vs `:522-556` | A `real`→`int` slip rounds ten parameters' stored values on every save; the current check misses all ten (H5, verified). | `eq( type, FXRanges[name][2] === 0 ? 'int' : 'real' )`. |
| **Validation reports rather than throws** | `FXProcessing.js:1064-1124` `fxValidate` | `CONTRIBUTING.md:162-164` makes this a house rule. `fxValidate` loads under the shim and has zero assertions. | Export it; drive missing channels, a colour view where greyscale is required, mismatched geometry and a bad identifier; assert each returns a message and none throws. |
| **The preview status line composes all of its notes** | `FXDialog.js:338-360` | An assignment where an append was meant silently discards the linear-data banner (M8). | Extract the note composition into a pure function in `FXProcessing.js` or `FXParameters.js` and assert that each contributing condition appears in the result independently. |
| **Two-channel switching lands somewhere the user was promised** | `FXParameters.js:227-233, 439-453` | The shipping tooltip promises "the Ha / Oiii equivalent"; the code takes the first non-Sii style (M9). The one existing assertion pins a strictly weaker property. | Assert `fxSetChannelCount(true)` from each Sii palette lands on the intended counterpart, and that a user-typed `baseId` survives while a stock one is replaced. |
| **`fxResetAllLevels` / `fxLevelsInForceElsewhere` report what they cleared** | `FXParameters.js:370-397` | `README.md:570-572` and `RELEASING.md` both make claims about these; both are pure functions over `FX` and neither is exported. | Export and assert directly. |
| **The sidecar validator runs on the path that ships** | `ci.yml:53-88` vs `release.yml` | H4. The one guard on the repository-wide entity rule is absent from the release. | `workflow_call` from both, or copy the step into `release.yml`. |
| **The shim's `format()` matches PixInsight's** | `tests/shim.js:11-48` | Four measured divergences from C (M1); every numeric literal in every expression flows through it. | `tests/shim.test.js` with a table generated once from C `printf`. |

---

## Documentation claims checked

`docs/ARCHITECTURE.md` — every claim.

| # | Claim | Line | Settled by | Verdict |
|---|---|---|---|---|
| A1 | Everything produced is a PixelMath string or a stock process; no pixel arithmetic in JavaScript anywhere | 3-6 | `FXHistogram.js:56-62` samples pixels in JS | **FAILS (narrowly)** — true of the render path, false of the histogram widget. See L3. |
| A2 | File table: nine files, each with the stated responsibility | 10-20 | All nine exist and match | **HOLDS** |
| A3 | The three named libs load under the shim and are bundled and driven | 22-24 | `tests/run.sh:33-37` `LIBS` | **HOLDS** |
| A4 | The other four build controls at load time and are only parsed | 24-26 | `tests/run.sh:40-46` `UNBUNDLED` | **HOLDS** |
| A5 | The preview runs the same expression strings and process instances as Execute; only spatial sampling differs | 30-33 | `FXProcessing.js:1185-1353` — one `fxRenderParts`, driven by both paths | **HOLDS** |
| A6 | *Foraxx — classic* at defaults reproduces the original bit for bit; the expressions are pinned in `tests/expressions.test.js` | 38-41 | `tests/expressions.test.js:27-39` pins all five strings literally | **HOLDS** (pinning confirmed; bit-for-bit equality is unverifiable in-repo — the original is not present) |
| A7 | `R = O^~O·S + ~(O^~O)·H`, `G = (H·O)^~(H·O)·H + ~(…)·O`, `B = O` | 45-49 | `FXExpressions.js:253-266`; pinned at `expressions.test.js:29-34` | **HOLDS** |
| A8 | Since 2.5.0 transitions belong to RGB slots, not channels | 51-53 | `FXExpressions.js:261-264` indexes `base[map[n]]` | **HOLDS** |
| A9 | Red always carries Sii↔Ha, green always Ha↔Oiii, blue is the anchor and is never blended | 52-54 | `FXExpressions.js:261-265`; `b = base[map[2]]` unconditionally | **HOLDS** (with the documented exception that red carries no transition when `o == null`, i.e. no Sii — stated at `:259-260`) |
| A10 | Amount 0 is exactly the permutation the fixed palettes always were | 54-56 | `fxMix( …, 0 )` returns the second term; `expressions.test.js:46-55` asserts it for every fixed palette | **HOLDS** |
| A11 | Raising the amount on a fixed palette walks it to its Foraxx counterpart | 56-57 | `expressions.test.js:62-70` asserts fixed SHO at 1 equals dynamic SHO, string for string | **HOLDS** |
| A12 | Per channel rather than per slot would collapse green and blue in HOO | 57-58 | `expressions.test.js:78-90`; `map[1] == map[2] == 'O'` in HOO | **HOLDS** |
| A13 | Masks always come from the starless context; signature is `fxBuildExpressions( p, maskCtx, valueCtx )` | 60-62 | `FXExpressions.js:226-230` — `m` from `maskCtx`, `v` from `valueCtx`; asserted at `expressions.test.js:108-117` | **HOLDS** |
| A14 | Fixed notation, six decimals (`fxNum`) | 66-67 | `FXExpressions.js:89-92` — twelve decimals below 1e-4 | **FAILS** — see L1. |
| A15 | Never reach for `%e` | 68 | `FXProcessing.js:135-137` uses `%.3e` and `%.0e` | **FAILS (narrowly)** — true of expression literals, false of console text. See L4. |
| A16 | Star stretch emits `3^k` symbolically; the balance is 1/6562 at k=8 | 69-71 | `FXExpressions.js:307-315`; `1/(1+3^8) = 1/6562` | **HOLDS** |
| A17 | `fxGain(x,1)` returns `x`; `fxMix(a,b,0)` returns `b` | 72-73 | `FXExpressions.js:149-150, 184-185`; asserted at `expressions.test.js:138-140` | **HOLDS** |
| A18 | Output is always 32-bit floating point | 77-79 | `FXProcessing.js:492-500` falls back to `SameAsTarget`; one call site | **FAILS (narrowly)** — see L2. |
| A19 | Identifiers are never overwritten; a numeric suffix moves the whole group | 81-83 | `FXProcessing.js:62-79`; `naming.test.js:35-64` | **HOLDS** |
| A20 | No `#engine v8`; the other CaeloWorks scripts declare it | 87-88 | Absent from `pjsr/`; present at `pix-sky-intruders/pjsr/SkyIntruders.js:13` | **HOLDS** |
| A21 | The README supports PixInsight back to 1.8.9 | 90 | `README.md:62`; `PI_VERSION_RANGE="1.8.9:1.9.99"` | **HOLDS** |
| A22 | CC BY-NC 4.0 rather than GPL-3.0, and not a choice — see `LICENSE` and `NOTICE.md` | 92 | `LICENSE` "WHY THIS LICENCE"; `NOTICE.md:29-34` | **HOLDS** |

`README.md` — 38 claims sampled across installation, licensing, expressions, defaults, ranges,
output naming, preview, histogram and layout. Full detail on the four failures in M8, M9, M10 and
the Verification section; the table below lists the checks.

| # | Claim | Line | Settled by | Verdict |
|---|---|---|---|---|
| R1 | Requires PixInsight 1.8.9 or later | 62 | `build-update-package.sh:23` | **HOLDS** |
| R2 | The zip carries the `src/scripts/CaeloWorks/ForaxxPaletteStudio` tree | 56-58 | `build-update-package.sh:30,36`; enforced by `check-package.sh` | **HOLDS** |
| R3 | Appears under Script → CaeloWorks → Foraxx Palette Studio | 60 | `ForaxxPaletteStudio.js:250` `#feature-id` | **HOLDS** |
| R4 | The repository is unsigned and PixInsight warns; that is expected | 49-50 | `build-update-package.sh:64` `SIGNED=0`; `check-package.sh:172-176` refuses a `.xsgn` | **HOLDS** |
| R5 | CC BY-NC 4.0 inherited, not chosen; `NOTICE.md` is part of the terms and travels with the script | 688-692 | `LICENSE`; `build-update-package.sh:46-47`; `check-package.sh:194-195` | **HOLDS** |
| R6 | The licence notice stays in the file header and appears nowhere on screen | 172-179 | `ForaxxPaletteStudio.js:26-48`; no upstream name occurs anywhere in `pjsr/lib/` | **HOLDS** |
| R7 | The requirement for non-linear data is stated in the header, the Feature Scripts description and the dialog banner | 91-93 | `ForaxxPaletteStudio.js:13-20, 253`; `FXDialog.js:379-380` | **HOLDS** |
| R8 | The status line warns in capitals when the channels look linear | 34-35 | `FXDialog.js:348-350`, but discarded by `:351` | **FAILS** — see M8. |
| R9 | Soft gain `g·x / (1 + (g−1)·x)` | 493 | `FXExpressions.js:147-157` | **HOLDS** |
| R10 | `o = Oiii^(k·~Oiii)` | 495 | `FXExpressions.js:162-167, 255` | **HOLDS** |
| R11 | `ho = (Ha·Oiii)^(k·~(Ha·Oiii))` | 496 | `FXExpressions.js:253-254` | **HOLDS** |
| R12 | Foraxx amount: 0.00 fixed mapping, 1.00 full dynamic | 494 | `FXExpressions.js:180-187, 261-264` | **HOLDS** |
| R13 | Star mix `R = 0.5·Ha + 0.5·Sii`, `G = 0.3·Ha + 0.7·Oiii`, `B = Oiii`; `0.5·Ha + 0.5·Ha` with no Sii | 509-511 | `FXExpressions.js:286, 317-330` | **HOLDS** |
| R14 | Star brightness `((3^k)*$T)/((3^k-1)*$T+1)`; 0 leaves the stars untouched; at k=5 the multiplier is 243 | 517 | `FXExpressions.js:307-315`; `3^5 = 243` | **HOLDS** |
| R15 | Combined view is the screen blend `~(~starless · ~stars)` | 527 | `FXExpressions.js:432-434` | **HOLDS** |
| R16 | Star green removal is SCNR / mtf / SCNR / reverse-mtf, on by default | 516 | `FXProcessing.js:857-868`; `FXParameters.js:281` | **HOLDS** |
| R17 | Hermite end slope capped at 4 so the strongest setting stays monotonic | 441-444 | `FXExpressions.js:399` `min(4, max(1, 1+3*a))`; the derivative argument checks out | **HOLDS** |
| R18 | Highlight compression is computed on luminance and applied as one scale factor to all three channels | 552 | `FXExpressions.js:391-403` | **HOLDS** |
| R19 | Signature curves: 0.00 skips, 1.00 original, 2.00 doubles | 497 | `FXRanges.curveStrength = [0,2,2]`; `FXProcessing.js:422-432` | **HOLDS** |
| R20 | HDR section off by default, every amount at 0 | 543-545 | `FXParameters.js:294-300` | **HOLDS** |
| R21 | Compression knee starts at 0.60 and does nothing while the amount is 0 | 548 | `FXParameters.js:296`; `FXExpressions.js:379-380` | **HOLDS** |
| R22 | Channel normalization off by default; shadow point 0 sits on the minimum and discards nothing | 479, 487 | `FXParameters.js:256`; `FXProcessing.js:241-255`; `normalization.test.js:44-45` | **HOLDS** |
| R23 | Green/magenta suppression is stock SCNR average neutral; magenta is invert / SCNR / invert | 530-537 | `FXProcessing.js:905-948` | **HOLDS** |
| R24 | Suppression does not touch the stars | 523-525 | `FXProcessing.js:1252` vs `:1298-1304` | **HOLDS** |
| R25 | Foraxx amount and both transition sliders grey out on fixed palettes, and the amount is held at 0 there | 494-496 | `FXDialog.js:1803-1805`; `FXParameters.js:637-638, 667-674`; `parameters.test.js:215-218` | **HOLDS** |
| R26 | Artificial luminance is CIE L*a*b* L with no method choice, named `name_L`; substitution stops where a channel would clip | 574-592 | `FXProcessing.js:979-1041`; `FXExpressions.js:413-427` (`headroom`) | **HOLDS** |
| R27 | Suffixes `_stars`, `_combined`, `_o`, `_ho`, `_L`, numbered as one group | 594-599 | `FXProcessing.js:64`; `naming.test.js:10, 35-64` | **HOLDS** |
| R28 | Output always 32-bit float | 659-660 | `FXProcessing.js:492-500` | **FAILS (narrowly)** — same as A18. |
| R29 | Validation reports rather than throws | 662 | `FXProcessing.js:1064-1124`; `FXDialog.js:1543-1548` | **HOLDS** (untested — see coverage gaps) |
| R30 | Wheel zoom ×1.25 / ×0.8 anchored on the cursor; double click returns to Fit; zoom never re-renders | 612-617 | `FXPreview.js:50-53, 168-217, 253-267, 293-319` | **HOLDS** |
| R31 | Detail "Auto" renders at twice the panel resolution | 618-619 | `FXPreview.js:441` `OVERSAMPLE = 2` | **HOLDS** |
| R32 | Star channels are downsampled peak-first, nebula channels averaged, and the request is read back and reported | 261-266 | `FXPreview.js:484-503, 529-531, 545-547`; `FXDialog.js:356-360` | **HOLDS** |
| R33 | Histogram shows the image immediately before its own levels transform, one log-scaled outline per channel | 561-568 | `FXProcessing.js:1200-1213, 1259-1270`; `FXHistogram.js:143, 403-428` | **HOLDS** |
| R34 | Three independent levels sets, each applied only to its own image; a source change resets all three and names what carried something | 111-116, 570-571 | `FXParameters.js:354-383`; `FXProcessing.js:774-793, 1329-1332`; `parameters.test.js:166-186` | **HOLDS** |
| R35 | If a set is in force on an image you are not looking at, the status line says so | 572 | `FXDialog.js:343-345`, discarded by `:351` | **FAILS** — see M8. |
| R36 | Two draggable dividers, double click to reset, both sizes persist | 646-650 | `FXSplitter.js:92-96`; `FXParameters.js:339-340, 514-515` | **HOLDS** |
| R37 | Execute keeps the dialog open; Close is the only way out | 363-364 | `FXDialog.js:1529-1626` — no `this.ok()` | **HOLDS** |
| R38 | Only a run accepted with Execute becomes the new stored default | 657-658 | `ForaxxPaletteStudio.js:375` saves unconditionally | **FAILS** — see M10. |
| R39 | Switching to 2 channels moves a Sii palette to its Ha/Oiii equivalent (repeated in the shipping tooltip) | 421; `FXDialog.js:406-407` | `FXParameters.js:227-233, 439-453` — always style 5 | **FAILS** — see M9. |

`CONTRIBUTING.md` and `docs/RELEASING.md` — the checkable claims.

| # | Claim | Line | Settled by | Verdict |
|---|---|---|---|---|
| C1 | `tests/run.sh` runs five suites, then syntax-checks the files that build controls at load time | CONTRIBUTING:123-125 | Observed: 5 suites, 1262 assertions, 5 unbundled parses | **HOLDS** |
| C2 | The five suites hold what the table says they hold | CONTRIBUTING:127-133 | Read all five | **HOLDS** |
| C3 | The runner picks up anything matching `*.test.js` and totals the per-suite counts | CONTRIBUTING:139-141 | `run.sh:134-141` | **HOLDS** — but the total is never compared (H1, M4) |
| C4 | A new lib file must be reachable by `#include`, "which CI checks" | CONTRIBUTING:148-151 | `ci.yml:109-120` | **HOLDS** (the converse is not checked — M3) |
| C5 | The bit-for-bit promise is about *Foraxx — dynamic SHO* | CONTRIBUTING:159 | No such style; it is *Foraxx - classic* | **FAILS** — see L5. |
| C6 | The Release workflow runs the same harness before building and fails the release if it is red | RELEASING:3-6 | `release.yml:164-165` | **HOLDS** |
| C7 | The staged dev build must show `vdev` at the bottom of the dialog | RELEASING:12-13 | `stage-dev.sh:270`; `FXDialog.js:1504` `"v" + VERSION` | **HOLDS** |
| C8 | `#define VERSION` holds `__BUILD__`, stamped by `build-update-package.sh` and by `stage-dev.sh` as `dev` | RELEASING:71-73 | `ForaxxPaletteStudio.js:264`; `build-update-package.sh:41`; `stage-dev.sh:270` | **HOLDS** |
| C9 | "There is no version number to keep in step by hand" | RELEASING:73-74 | Contradicted by RELEASING:37-38 and `README.md:7` | **FAILS** — see L6. |
| C10 | Signing is off; the site's ingest refuses a zip containing a `.xsgn` while the CPD is unpublished | RELEASING:94-97 | `build-update-package.sh:56-89`; `build-update-repo.sh:52, 122-128` | **HOLDS** |
| C11 | The Release workflow attaches the zip and `update-package.json` | RELEASING:60-61 | `release.yml:189-193` | **HOLDS** |
| C12 | CHANGELOG: "CI on every push: the harness on two Node versions, shellcheck, a package contract check mirroring the update site's ingest guards, and a build reproducibility check" | CHANGELOG:37-40 | `ci.yml` in full | **HOLDS** (accurate about CI; the release path is the gap — H4) |

---

## Verification

An adversarial pass over every finding. Three were dropped or corrected.

- **H1 (report() removal) — CONFIRMED by mutation.** Tried to refute it by arguing the FAIL text
  on stderr would be noticed: it is not — `run.sh:135` redirects it into `last.log`, which the
  next suite overwrites, and the runner prints `OK` regardless. Also checked whether `set -e`
  would catch it: no, `node "$t"` exits 0.
- **H2 (fxSanitize untested) — CONFIRMED, and strengthened.** I tried to refute it on the grounds
  that these functions need PixInsight (`Settings`, `Parameters`) and so belong in the hand gates.
  They do not: `fxSanitize`, all three migrations, `fxApplyStyle`, `fxSetChannelCount` and
  `fxValidate` touch only `FX`, `FXStyles`, `FXDefaults` and `FXRanges`, and I executed all of
  them under the unmodified shim. Only `fxLoadSettings`/`fxSaveSettings`/`fxImport…`/`fxExport…`
  genuinely need PixInsight, and those are thin loops over `FXPersisted`.
- **H3 (HDR gate) — CONFIRMED by direct invocation.** Tried to refute it by looking for the gate
  elsewhere: it exists, at `FXProcessing.js:1243, 1267`, which is why this is a
  *false-confidence* finding rather than a functional bug. The behaviour is correct today; the
  test that claims to protect it does not.
- **H4 (release without CI) — CONFIRMED, but downgraded from Critical.** My first reading was
  Critical ("a broken release can be published"). Refuted in part: `build-update-repo.sh:96-103`
  normalises the common undeclared entities, and `:227-233` validates the finished `updates.xri`
  with `minidom` and refuses to deliver if it is malformed. So the realistic outcome of a bad
  `descriptionHtml` is that the shared index build *stops*, not that a broken index ships. The
  uncaught residue — a missing SPDX header, an orphaned lib, a shellcheck regression — is real but
  not release-breaking. High, not Critical.
- **H5 (real→int) — CONFIRMED by mutation**, including the negative control: the same mutation on
  `normShadow` (fractional default) *is* caught, which is exactly why the hole is easy to miss.
- **M1 (shim divergence) — CONFIRMED by measurement, severity held at Medium.** I tried to raise
  it to High and could not: I checked every literal pinned by the five suites and none is a
  rounding tie, so no assertion is currently wrong. I also tried to drop it to Low and would not:
  the shim's own header makes exactness a stated contract, and the divergence is reachable through
  `format( "%.2f", starStretch )` on a value restored from a process icon.
- **M2 (HDR `||`) — CONFIRMED by mutation:** the suite stayed green with the zero guard deleted.
- **M3 (unresolvable `#include`) — CONFIRMED by mutation**, with the refinement that the
  *repointed* include is caught as a side effect of the orphan check; only the *added* include is
  invisible. Severity held at Medium rather than High for that reason.
- **M4, M5, M6, M7 — CONFIRMED**, M4 and M5 by direct experiment, M6 and M7 by reading.
- **M8, M9, M10 — CONFIRMED** by reading the cited source lines myself after the README sweep, not
  taken on trust. M9 was checked twice: the README occurrence is inside the collapsed *Previously,
  in 2.2.0* block and is arguably historical, but the same claim is live in the shipping tooltip
  at `FXDialog.js:406-407`, which is what sustains the finding.
- **REFUTED — "the menu icon is installed one directory too deep."** I suspected
  `#feature-icon @script_icons_dir/ForaxxPaletteStudio.svg` (`ForaxxPaletteStudio.js:251`) would
  resolve to `rsc/icons/script/ForaxxPaletteStudio.svg`, whereas the package writes
  `rsc/icons/script/ForaxxPaletteStudio/ForaxxPaletteStudio.svg`. Settled against the installed
  PixInsight at `/mnt/c/Program Files/PixInsight`: `AnnotateImage.js:22` declares
  `@script_icons_dir/AnnotateImage.svg` and its icon lives at
  `rsc/icons/script/AnnotateImage/AnnotateImage.svg` — there is no flat copy. 35 of the 39 entries
  under `rsc/icons/script/` use the subdirectory form. `@script_icons_dir` resolves per script.
  **The packaging is correct**, and matches `pix-sky-intruders`. The only surviving point is that
  `check-package.sh` derives the path from the same literal as the builder (M7).
- **REFUTED — "the README contradicts the shipping defaults on `starStretch`."** README:167 says
  star brightness starts at 0 while `FXParameters.js:282` has `starStretch: 1.00`; README:236
  describes an "Apply star stretch" tick box that does not exist; README:248 says Warhol asks for
  the stretch, and `FXStyles[6]` sets no `starStretch`. All three are inside the collapsed
  `<details>` block spanning `README.md:66-461`, under *What's new in 2.6.0* and *What's new in
  2.4.0* — historical release notes, accurate for the releases they describe (README:150 records
  2.6.1 changing the default to 1.00). Not a contradiction. What survives is a nit worth recording
  without a number: 396 of the README's 696 lines duplicate `CHANGELOG.md`, and two records of the
  same history drift.
- **CORRECTED — L11 (reproducibility).** I first wrote this as a packaging fault. On checking the
  ingest contract, the site verifies the sidecar's SHA-1 against the *published* zip — the same
  artifact — so reproducibility is not a contract requirement, only an auditability property. The
  finding stands at Low, reworded.
- **Not a finding: the `dist/` artifact and `testset/`.** `dist/` is ignored by both `.gitignore`
  and `.git/info/exclude`; `testset/` is ignored as of an in-flight edit to `.gitignore` (below).

### Working tree

`git status` shows one modification I did not make: **`.gitignore` was edited by another agent
at 08:14 today** (adding `testset/` with a two-line comment), three minutes before I first
observed it. I have left it untouched. Every mutation I ran — nine in total, across
`pjsr/lib/FXExpressions.js`, `pjsr/lib/FXParameters.js`, `pjsr/ForaxxPaletteStudio.js`,
`tests/naming.test.js` and a temporary `tests/zzz.test.js` — was restored from a backup
immediately after the measurement, and `bash tests/run.sh` is green at 1262 assertions.
Apart from this report and that concurrent `.gitignore` edit, the tree is as I found it.
`dist/` now holds `ForaxxPaletteStudio-0.0.0-audit.zip` rather than the `-0.0.0-ci` build that was
there before; `dist/` is gitignored and is rebuilt by every invocation of the builder.
