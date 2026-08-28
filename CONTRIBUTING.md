# Contributing

## Before anything else

The script takes **non-linear (stretched) images only**. A black or washed-out
result from linear data is the documented behaviour, not a bug — linear support
was removed in 3.0.0 after four separate faults in the auto stretch failed to
make it reliable. Please do not reopen it without new evidence.

## Getting set up

```sh
./scripts/stage-dev.sh              # stage the tree where PixInsight can load it
bash tests/run.sh                   # expression suite + syntax check of every PJSR file
bash scripts/build-update-package.sh 0.0.0-dev   # build the distributable zip into dist/
```

`stage-dev.sh` copies `pjsr/` to a folder PixInsight can open — on WSL it finds
your Windows `LocalAppData` on its own — and stamps the version as `dev`. Point
**Script → Feature Scripts → Add** at that folder, or run it straight from
**Script → Execute Script File…**. Re-run the script after each edit.

`tests/run.sh` bundles the two pure-logic libraries and runs real assertions
against the PixelMath expressions, then syntax-checks every other PJSR file. It
catches syntax errors and expression regressions, not PJSR API misuse — there is
no substitute for running the thing in PixInsight. See `docs/RELEASING.md` for
the hand gates a release has to pass.

## Layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the file-by-file map and
the two invariants that govern changes.

A new file in `pjsr/lib/` must be reachable by `#include` from the entry point,
directly or through another lib file — an orphan file packages fine and then is
not there at runtime. Add it to `tests/run.sh` too: to `LIBS` if it is pure
logic, to `UNBUNDLED` if it touches PixInsight objects.

## House rules

- **The preview is not an approximation.** It runs the same expression strings
  and the same process instances as Execute, on downsampled copies. Any change
  that makes one path diverge from the other is a bug, however convenient.
- **Defaults are a promise.** *Foraxx — dynamic SHO* at defaults produces a
  starless image identical, bit for bit, to the original Foraxx Palette Utility.
  Anything that moves that number is a major version.
- **Validate, do not throw.** Missing channels, colour images where greyscale is
  required, mismatched geometry and invalid identifiers are reported to the
  user. Keep it that way.
- **The console report is the reproduction record.** A new parameter that
  changes the output belongs in `fxReport`.
- **Expressions are pinned.** `tests/expressions.test.js` holds the published
  forms literally. If a change moves one of those strings, that is a major
  version and the test is the place to argue it, not to update quietly.
- **Settings migrate.** People have process icons. A renamed or re-meaning'd
  stored key needs a migration path, as the 2.5.0 Foraxx-amount change did.
- **No name in the interface.** The licence notice stays in the file header,
  where the licences that require it are satisfied, and nowhere on screen.

## Credit and licence

New work here is contributed under CC BY-NC 4.0 (see `LICENSE`). If you port a
method from published work — a paper, another script, a documented process —
say so in the pull request and add it to `NOTICE.md`. Attribution is the
condition under which this script is allowed to exist.
