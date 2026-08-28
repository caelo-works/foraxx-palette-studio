# Audit 2026-08-28 — 00 · Index and prioritized backlog

Repository state: `main` @ `64591ce`. This index consolidates the six per-area reports
(`01-*.md` … `06-*.md`) plus the linear-input design study (`07-*.md`). Each report carries its
own adversarial verification pass; across the six, **27 candidate findings were refuted by their
own author** and are listed with reasons in their Verification sections. Totals before
deduplication: **Critical 1 · High 14 · Medium 34 · Low 41 · Nit 33.**

This is the first external review the code has had. It is also the first review of the repository
scaffolding — tests, CI, packaging, docs — which was written days ago by the current maintainer
and had never been checked by anyone else. Five of the fourteen High findings are in that
scaffolding, which is the right proportion for new work and the reason it was audited at all.

## 1. Overall health assessment

The inherited script is in good condition. The two invariants it stakes its reputation on both
hold: **the preview really does run the same pipeline as Execute** (same expression strings, same
process instances, conditioning maps measured on full-resolution sources in both paths — 05
verified this line by line), and the **published Foraxx expressions are emitted character for
character**, so the bit-for-bit promise against Paul Hancock's original is intact. Temporary-image
lifetime in the Execute path is genuinely well handled: 02 found no unconditional leak on any
reachable exception path. The 2.3.5 peak-first star downsampling is real and covers every star
path. Zoom anchoring drifts 0.5 px over twelve notches and does not accumulate. Packaging is the
strongest single area: `check-package.sh` honours every clause of the update site's ingest
contract, uses a whitelist rather than a blacklist for stray files, and CI re-derives the SHA-1
independently.

The weaknesses cluster in five places rather than spreading evenly.

**(a) The test harness cannot report its own death.** The only `process.exit(1)` lives in
`assert.js`'s `report()`. A suite that does not call it cannot fail: 06 removed the line from one
suite, broke an assertion, and the runner exited 0 saying "All tests passed". The runner prints
each suite's assertion count and never compares it to anything. Everything else in this audit is
conditioned on this being fixed first — until it is, a green harness is not evidence.

**(b) Residue from the 3.0.0 withdrawal of linear support.** The same class of defect as the empty
section headers already removed: `FXProcessing.js:846-853` argues at length that both star sliders
"default to 0, which is deliberate" while the shipped default is 1.00 — a value 2.6.1 chose *for
linear data* and 3.0.0 never revisited. `stats.madn` is computed on every channel and read
nowhere, while the `FXExpressions.js` header claims `c0` and `m` come from "the median and MAD,
exactly as PixInsight's screen transfer function computes them" — they come from the median and
the minimum. That unused MAD is precisely what the linear work needs.

**(c) State that outlives what it describes.** The preview caches downsampled copies keyed on
image *identifiers*, never content, and **Refresh** — whose tooltip promises "re-measuring the
sources" — does not release them. Edit a channel and the preview keeps showing the pre-edit
pixels. This is the exact loop linear support creates: see a black preview, go stretch the
channel, come back, press Refresh, see nothing change.

**(d) The dialog does not lock during a run.** Three controls are disabled during a
full-resolution Execute; roughly forty are not, and their handlers write `FX` immediately while
the pipeline reads it incrementally across some fifteen points. A slider nudged mid-run splices
two parameter sets into one image, and `fxReport` then prints the final state as though it had
been used throughout — destroying the reproducibility that report exists to provide.

**(e) Warnings that cannot be seen.** One `=` where its neighbours use `+=` discards the
capitalised linear-data warning whenever an HDR multiscale stage is on. The "levels have been
reset" notice is overwritten 0.4 s later by "Rendering preview…". Both behaviours are implemented,
documented, and imperceptible.

Nothing found threatens the palette maths. No finding touches the default output of
*Foraxx — classic*, so the parity gate is expected to stay at a maximum difference of 0 through
every fix below.

## 2. Critical and High findings, deduplicated

Effort: S = under half a day · M = 1–3 days · L = more than 3 days.

| ID | Title | Severity | Source | Effort |
|---|---|---|---|---|
| A1 | A suite that omits `report()` cannot fail; the runner prints a count it never checks | High | 06-H1 | S |
| A2 | Every control but three stays live during Execute; the pipeline reads `FX` incrementally, so a mid-run edit splices two parameter sets into one image | **Critical** | 04-C1 | M |
| A3 | `note =` instead of `note +=` discards the linear-data warning and the off-screen-levels warning whenever an HDR stage is on | High | 04-H1, 05-H4 | S |
| A4 | Editing a source image leaves the preview on stale pixels; **Refresh** does not release the cache its tooltip promises to refresh | High | 05-H1 | S |
| A5 | The star channel set is released on every starless render, so the documented independent caching does not exist in that direction | High | 05-H2 | S |
| A6 | Hidden temporary images leak unbounded when `makeChannel` throws: the list is local and only stored on success | High | 05-H3 | S |
| A7 | `release.yml` has no dependency on CI, skipping the sidecar validator and the whole hygiene job | High | 06-H4 | S |
| A8 | The settings/process-icon defensive layer (`fxSanitize`, three migrations, `fxValidate`) has zero assertions and is free to test | High | 06-H2 | S |
| A9 | `expressions.test.js` asserts an HDR gate `fxBuildHDRCompression` does not implement — the flag is never read | High | 06-H3, 01-M1 | S |
| A10 | A `real`→`int` slip in `FXPersisted` passes green for any whole-number default and would round every stored value | High | 06-H5 | S |
| A11 | Schema-gated migrations never run on the process-icon path: `fxLoadSettings` advances the schema before `fxImportParameters` reads it | High | 03-H1 | S |
| A12 | `fxValidate` re-resolves stale view wrappers into a loop-local and discards it, so it validates a different object from the one the pipeline renders | High | 02-H1 | S |
| A13 | The "levels reset", "Created …" and "No histogram yet" notices are erased by the preview refresh they trigger | High | 04-H2 | S |
| A14 | `FXProcessing.js:846-853` documents the opposite of the shipped `starStretch` default, and the reasoning it gives is about linear data 3.0.0 removed | High | 01-H1, 02-M1 | S |

Medium findings that recur across reports and are folded into the backlog: `fxStyle()` returns
`undefined` for a non-integer or NaN index and the migrations dereference it before `fxSanitize`
runs, so a corrupt settings file bricks the dialog on every subsequent launch (03-M1); "Reset all"
rewinds `paletteSchema`, re-arming non-idempotent one-shot migrations (03-M2); `fxSampleFormat32`
falls back to `SameAsTarget` silently, dropping the 32-bit invariant into 16-bit banding (02-M2);
`fxApplyHDRMT`/`fxApplyLocalContrast` swallow every failure while `fxReport` records the stage as
run (02-M3); peak-first downsampling biases the star histogram ~2.5σ upward, so **Auto** on the
Stars target fits a distribution the real image does not have (05-M1); `valueCtx` in
`fxBuildExpressions` is dead in production although `ARCHITECTURE.md` presents it as live (01-M3);
settings are saved on every close, not only on Execute, contradicting the README and
`CONTRIBUTING.md` (03-M3, 06 docs).

## 3. Prioritized backlog

### Release A — patch: integrity and honesty, zero change to the palette

1. **Make the harness able to fail** (A1). An exit handler in `assert.js` that forces a non-zero
   status when any assertion failed or when `report()` was never reached, plus a runner check that
   every suite emitted a summary line. Nothing else in this list can be trusted until this lands.
2. **Gate the release on CI** (A7). `needs:` on the tag workflow, or move the sidecar validator and
   the hygiene job into `release.yml`.
3. **The one-character and one-line fixes** (A3, A12, plus 03-M1). `note +=`; write the
   re-resolved view back before the pipeline reads it; make `fxStyle()` coerce a non-integer index
   instead of returning `undefined`.
4. **Preview cache correctness** (A4, A5, A6). Release the downsampled copies on Refresh; stop
   destroying the star set on starless renders; assign the temp list before the calls that fill it.
5. **Lock the dialog during Execute** (A2). Disable the panels for the duration and snapshot the
   parameters the run will use, so `fxReport` describes the run that happened.
6. **Close the test gaps that are free** (A8, A9, A10). Export `fxSanitize`, the migrations and
   `fxValidate` from the bundle and assert them; make the HDR gate real and the test non-vacuous;
   assert `FXPersisted` types against the live values.
7. **Migrations and schema** (A11, 03-M2). Import the icon before advancing the schema; keep
   `paletteSchema` out of the "Reset all" sweep.
8. **Say what is true** (A14 and the doc failures in 06). Correct the `fxApplyStarFinishing`
   comment, the `FXExpressions.js` STF claim, the `ARCHITECTURE.md` `valueCtx` claim, and the
   Execute-vs-Close claim in `README.md` and `CONTRIBUTING.md`.

### Release B — minor: linear input

Specified in `07-linear-input-design.md`, validated end to end on the reference masters: an
absolute stretch target replaces the relative one, the auto stretch and Channel normalization
collapse to a single MTF per channel, star frames keep the 2.6.1 shared-curve rule behind an
explicit off-by-default switch. Measured on the reference set, HEAD produces starless medians of
0.0071/0.0057/0.0057 — black — where the design produces 0.247/0.251/0.250.

Do not start it before Release A. Item 4 above is a prerequisite in practice: the workflow linear
support creates is "black preview → stretch the channel → Refresh", and Refresh does not currently
pick the change up. Item 1 is a prerequisite in principle: the design's whole test plan assumes a
harness that can fail.

The design's own shipping conditions stand: off by default behind an explicit switch; the UI says
"auto-stretch", not "linear is supported"; and **a second reference set with the pedestal
subtracted** (~1e-5 background) before the tag, because the present set sits at 2–5e-3 and never
exercises the deep-emission path that broke 2.3.4. Failing that, ship it marked experimental with
the tested depth range stated numerically.

## 4. What was refuted

Recorded so it is not re-investigated: a stale Sii view cannot leak into a two-channel palette
(`fxCollectIds` gates both paths); no dialog handler writes the wrong parameter (21 checked);
slider ranges cannot disagree with `FXRanges` by construction; there are no placebo parameters;
the 3.0.1 grey-out logic is correct across all 15 styles in both channel modes; zoom anchor drift
is 0.5 px and non-accumulating; `log(0)` and empty histogram bins are handled; marker order cannot
invert; the menu icon is installed at the depth PixInsight expects (35 of 39 stock entries use the
same form); and a fully NaN'd settings file leaves zero non-finite values behind.
