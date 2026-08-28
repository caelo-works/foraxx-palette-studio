# 08 — GeneralizedHyperbolicStretch: attempted, and withdrawn

Date: 2026-08-28. Written the day it was removed, because a decision whose
reasons are lost gets re-taken. Three of today's findings were exactly that:
comments describing behaviour 3.0.0 had removed, a tooltip citing a figure from
a pipeline that no longer existed, and an error message pointing at two controls
deleted six versions earlier.

## What was built

GHS was added as a third auto-stretch method beside the screen transfer and the
statistical stretch, at the maintainer's request. Unlike those two it is a
process rather than an expression, so it could not be folded into the
combination: the channels were conditioned into full-size copies first and the
palette expressions ran against those. That conditioning lived inside
`fxRenderParts`, the one function both the preview and Execute traverse.

It worked, in the sense that every part did what it was written to do. It was
removed because the result was not worth what it cost.

## Why it was withdrawn

**It has no target of its own.** The other two methods solve a midtones balance
so the background lands where you asked. GHS applies the force it is given, and
the force that suits data at 3e-3 is wrong for data at 1e-5. At the shipped
default it stretched the reference masters by 2.07x — median 0.0033 to 0.0068,
where 0.25 was wanted. Mathematically stretched, visually black.

**Giving it one required inverting the process numerically.** Seven bisection
steps on a thumbnail per channel, because reimplementing the transfer function
from memory was not defensible. That worked, but it made a single preview
refresh eight GHS passes per channel on top of six full-size copies.

**And the search is not safe in general.** GHS compresses everything below its
symmetry point towards black. With the symmetry point above the background — the
state you land in the moment you take manual control, because the stored default
suits stretched data — a stronger stretch makes the channel darker, and a
bisection that assumes otherwise converges on the worst value it can reach.
Measured: D 9.96, median exactly zero. That was guarded, and the guard worked,
but a method that needs a guard against its own solver searching backwards is a
method with a sharp edge.

**None of that produced a better image.** The maintainer's verdict, on real
data, was that it was not worth it — and that is the only verdict that counts on
a question of how a picture looks.

## If it is ever reconsidered

Three things would have to be true, and none of them was:

1. A defensible way to choose the stretch factor. Either the transfer function
   implemented from the published source rather than from memory, or a
   calibration that is honest about costing eight passes per channel.
2. The symmetry point constrained so it cannot sit above the background, or the
   manual control removed. Automatic per-channel placement worked; the failure
   was entirely in the manual path.
3. A reason to prefer it. It is the better stretch in expert hands, on data
   someone has looked at. As an unattended auto-stretch feeding a palette
   preview, it was not better than the statistical stretch, and it cost six
   full-size temporaries and a numeric search to be no better.

The two remaining methods, screen transfer and statistical stretch, both reduce
to a black point and a midtones balance the expression writer folds into the
combination. That is why they cost nothing, and why they are still there.


# Appendix — a scrollable settings column, three attempts and the answer

Same day, same shape of lesson, so it is recorded in the same place.

The settings column is taller than most screens with every section open, and
with the window no longer resizing itself on collapse the bottom of it was out
of reach. A ScrollBox around the column is the obvious answer. It took three
attempts, and each failure hid the next problem, so all four are written down.

**Attempt 1** put the panel in `ScrollBox.viewport.sizer` with no height of its
own. Every section compressed to a few pixels: a sizer given less room than its
children need takes it from them anyway, so the panel never exceeded the
viewport and there was nothing to scroll.

**Attempt 2** set the panel's height explicitly, measured from its contents.
Measured at construction it returned zero - no control reports itself visible
before the dialog is shown. Moved to `onShow`, the measurement came back like
this, on a 1152-pixel screen:

| item | height | minHeight |
|---|---|---|
| section bars (even) | 19 | 19 |
| section controls (odd) | 38 | 0 |
| total | 589 | viewport 585 |

`minHeight` is 0 for the section controls, so PJSR does not expose the natural
height; and by `onShow` they are already compressed to 38 pixels where they need
100 to 250. The measurement measured the compression it existed to correct.

**Attempt 3 — the answer.** Give the panel far more room than it could ever
want, let the layout run, and measure there. At 20000 pixels nothing is
compressed, every control settles at its own size, and the sum is honest: 1559
against a 585-pixel viewport. Then set the panel to the measured height.

That fixed the measurement and exposed three more faults, each of which had been
invisible behind the one before it.

- **A ScrollBox does not move its viewport's children.** Measured, not assumed:
  range set to 0..974, position driven to 300, panel still at y 0. The offset
  has to be applied by hand, and the panel therefore cannot belong to a sizer -
  one would undo `move()` at the next layout pass. `AstroColorMixer`, the only
  script shipped with PixInsight that puts real controls in a ScrollBox, keeps a
  sizer on the viewport and has no scroll handler at all. It is not a model to
  copy: it does not scroll.

- **The range must be set before `pageHeight`.** A page set first is left to be
  clamped by the range that follows, and a page as large as its range draws a
  thumb that fills the track.

- **`showScrollBars()` is not optional.** A ScrollBox hides both bars until
  asked. A range set on a hidden bar changes nothing anyone can see. Two
  relaunches went into diagnosing a correct range on a bar that was not there -
  helped along by the dark strip at the column's edge being the width splitter,
  which looks enough like a scrollbar to be dragged in vain.

**What shipped.** `scrollLeftTo()` is the single entry point; the bar and the
wheel both route through it. Folding a section remeasures the column in place
and leaves the window alone.
