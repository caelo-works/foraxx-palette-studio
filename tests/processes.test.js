// The process wrappers — sample format, and what the optional stages report.
//
// Two invariants live here, both of which used to be silent. Every image the
// script produces must leave PixelMath in floating point, because the dynamic
// factors are fractional powers and a 16-bit container bands exactly in the
// transition zones the palette is built around. And a stage that did not run
// must not be recorded as though it had, because the console report is what a
// run is reproduced from.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, report } = require( './assert.js' );

const VIEW = { id: 'ref', isNull: false, image: { width: 4096, height: 4096 } };

function fresh()
{
   fx.fxTestProcessReset();
   fx.fxTestConsoleReset();
   fx.fxTestSampleFormats( { f32: true, f64: true } );
}

// ---------------------------------------------------------------------------
// Sample format
//
// The fallback chain is f32, then f64, then whatever the source is. The last
// one violates the invariant, so it is allowed only with a warning: it is the
// difference between a known limitation and a silent one.
// ---------------------------------------------------------------------------

fresh();
eq( fx.fxSampleFormat32(), 'f32', 'the 32-bit float enumerator is preferred' );
eq( fx.fxTestConsole().warnings.length, 0, 'the preferred path warns about nothing' );

fresh();
fx.fxTestSampleFormats( { f64: true } );
eq( fx.fxSampleFormat32(), 'f64',
    'without f32, 64-bit float is taken before falling back to the source format' );
eq( fx.fxTestConsole().warnings.length, 0,
    'wider than asked for still honours the invariant, so it says nothing' );

fresh();
fx.fxTestSampleFormats( {} );
eq( fx.fxSampleFormat32(), 'SameAsTarget',
    'with no float enumerator at all, the source format is the last resort' );
eq( fx.fxTestConsole().warnings.length, 1,
    'and dropping the invariant is said out loud' );
ok( /band/i.test( fx.fxTestConsole().warnings[0] ),
    'the warning names the consequence the user will see' );

// Once a run, not once a call: the preview builds several images per keystroke.
fx.fxSampleFormat32();
fx.fxSampleFormat32();
eq( fx.fxTestConsole().warnings.length, 1, 'the warning is not repeated' );

// The invariant as the pipeline actually reaches it.
fresh();
fx.fxPixelMathNew( VIEW, 'out', true, 'x', false, false );
eq( fx.fxTestLastProcess( 'PixelMath' ).newImageSampleFormat, 'f32',
    'fxPixelMathNew asks PixelMath for floating point output' );
eq( fx.fxTestLastProcess( 'PixelMath' ).newImageColorSpace, 'RGB',
    'and for the colour space it was told to make' );
ok( fx.fxTestLastProcess( 'PixelMath' ).executed, 'and runs it' );

// ---------------------------------------------------------------------------
// HDRMultiscaleTransform
//
// Three outcomes, and the caller has to be able to tell them apart: skipped
// because nothing was asked for, skipped because the process is not installed,
// skipped because the process refused this image. Only the first is silent.
// ---------------------------------------------------------------------------

fresh();
let r = fx.fxApplyHDRMT( VIEW, 0, false );
eq( r.ran, false, 'no layers asked for, nothing runs' );
eq( r.layers, 0, 'and no layers are reported' );
eq( r.why, null, 'which is not a failure' );
eq( fx.fxTestConsole().warnings.length, 0, 'so nothing is said' );

fresh();
r = fx.fxApplyHDRMT( VIEW, 6, false );
eq( r.ran, true, 'a real request runs' );
eq( r.layers, 6, 'and reports the layer count it used' );
eq( fx.fxTestLastProcess( 'HDRMultiscaleTransform' ).numberOfLayers, 6,
    'which is the count the transform received' );

// The size cap, which is the whole reason the effective count has to be
// reported. A dyadic transform needs roughly 2^n pixels a side, so a preview
// scaled down to fit carries fewer layers than the slider asks for, and the
// count that ran is what the record must show.
fresh();
r = fx.fxApplyHDRMT( { image: { width: 320, height: 240 } }, 8, false );
eq( r.ran, true, 'a fitted preview still runs' );
eq( r.layers, 6, 'with the layer count capped to what the short side can carry' );
ok( r.layers < 8, 'which is fewer than the slider asked for' );

fresh();
r = fx.fxApplyHDRMT( { image: { width: 64, height: 64 } }, 6, false );
eq( r.layers, 5, 'a smaller frame caps harder' );
eq( fx.fxTestLastProcess( 'HDRMultiscaleTransform' ).numberOfLayers, 5,
    'and the transform is given the capped count, not the requested one' );

fresh();
fx.fxTestProcessFail( 'HDRMultiscaleTransform', 'construct' );
r = fx.fxApplyHDRMT( VIEW, 4, false );
eq( r.ran, false, 'a missing process does not run' );
eq( r.why, 'unavailable', 'and is reported as missing' );
ok( /not available in this installation/.test( fx.fxTestConsole().warnings[0] ),
    'the message sends the user to their module list' );

fresh();
fx.fxTestProcessFail( 'HDRMultiscaleTransform', 'execute' );
r = fx.fxApplyHDRMT( VIEW, 4, false );
eq( r.ran, false, 'a process that refuses the image does not run either' );
eq( r.why, 'failed', 'but that is a different outcome' );
eq( r.layers, 0, 'and no layers are claimed' );
ok( /failed/.test( fx.fxTestConsole().warnings[0] ),
    'and the message sends the user to the error, not to their module list' );

// ---------------------------------------------------------------------------
// UnsharpMask
// ---------------------------------------------------------------------------

fresh();
r = fx.fxApplyLocalContrast( VIEW, 0, false );
eq( r.ran, false, 'no local contrast asked for, nothing runs' );
eq( fx.fxTestConsole().warnings.length, 0, 'silently' );

fresh();
r = fx.fxApplyLocalContrast( VIEW, 0.5, false );
eq( r.ran, true, 'a real request runs' );
eq( r.amount, 0.4, 'and reports the amount the process received, not the slider' );
eq( fx.fxTestLastProcess( 'UnsharpMask' ).amount, 0.4,
    'which is what UnsharpMask was given' );

// The floor. UnsharpMask refuses anything below 0.10, so the bottom of the
// slider is not the bottom of the effect.
fresh();
r = fx.fxApplyLocalContrast( VIEW, 0.01, false );
eq( r.amount, 0.1, 'below the process floor the amount is raised to it' );

fresh();
fx.fxTestProcessFail( 'UnsharpMask', 'construct' );
r = fx.fxApplyLocalContrast( VIEW, 0.5, false );
eq( r.ran, false, 'a missing process does not run' );
eq( r.why, 'unavailable', 'and is reported as missing' );

fresh();
fx.fxTestProcessFail( 'UnsharpMask', 'execute' );
r = fx.fxApplyLocalContrast( VIEW, 0.5, false );
eq( r.ran, false, 'a process that refuses the image does not run' );
eq( r.why, 'failed', 'and says so distinctly' );
eq( r.amount, 0, 'and claims no amount' );

report( 'processes' );
