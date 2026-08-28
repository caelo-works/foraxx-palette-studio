// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Processing_js
#define __FX_Processing_js

/*
 * *****************************************************************************
 *
 * FXProcessing.js - the render pipeline.
 * Part of Foraxx Palette Studio.
 *
 * One code path builds both the preview and the final images. The preview
 * simply points the same functions at downsampled copies of the source
 * channels, so a preview is never an approximation of the result - it is the
 * result, computed on a smaller grid.
 *
 * The two exceptions are noted where they occur: HDRMultiscaleTransform and
 * the local contrast pass work on spatial scales, so at a reduced sampling
 * they can only be indicative.
 *
 * *****************************************************************************
 */

#include "FXParameters.js"
#include "FXExpressions.js"

/*
 * Identifier prefix owned by this script. Every hidden working image is
 * named with it, and fxSweepTemporaries reclaims anything that carries it.
 */
#define FX_TEMP_PREFIX "FXtmp_"

/*
 * Pump the event loop.
 *
 * The bare global is deprecated under V8 and says so on the console every time
 * it is called - which, on a dialog that pumps between pipeline stages, is a
 * warning per keystroke. CoreApplication.processEvents is the current spelling;
 * the fallback is there because the minimum supported core is 1.9.0 and this
 * has not been verified on every build in that range.
 */
function fxProcessEvents()
{
   try
   {
      if ( typeof CoreApplication != "undefined"
        && typeof CoreApplication.processEvents == "function" )
      {
         CoreApplication.processEvents();
         return;
      }
   }
   catch ( x )
   {
   }
   processEvents();
}

/*
 * What a thrown thing has to say for itself.
 *
 * Under V8 the core does not always throw an Error: a string, or an object with
 * no message property, both reach a catch clause. Reading .message off those
 * yields the literal word "undefined", which is how a real failure came back as
 * "Preview failed: undefined" and took its own cause with it.
 */
function fxErrorText( e )
{
   if ( e == null )
      return "unknown error";
   try
   {
      if ( typeof e.message == "string" && e.message.length > 0 )
         return e.message;
      let s = String( e );
      return ( s.length > 0 && s != "[object Object]" ) ? s : "unknown error";
   }
   catch ( x )
   {
      return "unknown error";
   }
}

/*
 * -----------------------------------------------------------------------------
 * Small helpers
 * -----------------------------------------------------------------------------
 */

function fxClamp( x, lo, hi )
{
   return (x < lo) ? lo : ((x > hi) ? hi : x);
}

function fxViewExists( id )
{
   let v = View.viewById( id );
   return v != null && !v.isNull;
}

function fxUniqueViewId( baseId )
{
   let id = baseId;
   for ( let n = 0; fxViewExists( id ); )
      id = baseId + format( "%02d", ++n );
   return id;
}

/*
 * Resolves a base identifier against every suffix the pipeline may use, so a
 * run always produces a matching set: Foraxx01 / Foraxx01_stars /
 * Foraxx01_combined rather than a mixture of numbered and unnumbered names.
 */
function fxUniqueBaseId( baseId )
{
   const SUFFIXES = [ "", "_stars", "_combined", "_o", "_ho", "_L" ];
   let id = baseId;
   for ( let n = 0; ; )
   {
      let taken = false;
      for ( let i = 0; i < SUFFIXES.length; ++i )
         if ( fxViewExists( id + SUFFIXES[i] ) )
         {
            taken = true;
            break;
         }
      if ( !taken )
         return id;
      id = baseId + format( "%02d", ++n );
   }
}

function fxCloseViewById( id )
{
   if ( !id )
      return;
   try
   {
      let w = ImageWindow.windowById( id );
      if ( w != null && !w.isNull )
         w.forceClose();
   }
   catch ( x )
   {
      // A leftover temporary is harmless; never let clean-up abort the script.
   }
}

/*
 * -----------------------------------------------------------------------------
 * Channel statistics
 * -----------------------------------------------------------------------------
 */

/*
 * Midtones transfer function, evaluated numerically.
 */
function fxMTFValue( m, x )
{
   if ( x <= 0 ) return 0;
   if ( x >= 1 ) return 1;
   if ( Math.abs( m - 0.5 ) < 1.0e-9 ) return x;
   return ((m - 1) * x) / (((2 * m - 1) * x) - m);
}

/*
 * Solves MTF( m, x ) = y for m. Used to place a channel's median exactly on
 * the requested target background.
 */
function fxSolveMTF( x, y )
{
   if ( x <= 0 || x >= 1 || y <= 0 || y >= 1 )
      return 0.5;
   let den = x - 2 * x * y + y;
   if ( Math.abs( den ) < 1.0e-12 )
      return 0.5;
   // The floor here has to match fxMTF's, or a solved balance is clamped away
   // before the expression is even built. 0.001 - the value this replaced - is
   // roughly forty times larger than what a faint channel needs, and clamping to
   // it left the result far below where it was asked to sit.
   let m = (x * (1 - y)) / den;
   if ( m < FX_MTF_MIN )
   {
      // Lowering the floor moved the failure rather than removing it: at
      // m = 1e-8 the curve is very nearly a step, so a channel that used to
      // come out black now comes out blown. Either way the user should hear it.
      Console.warningln( format( "Channel normalization: the midtones balance needed (%.3e) is "
                               + "below the %.0e floor. This channel has almost no signal above "
                               + "its black point and will render blown out.", m, FX_MTF_MIN ) );
   }
   return fxClamp( m, FX_MTF_MIN, 0.999 );
}

/*
 * Median and normalised MAD per view identifier.
 *
 * These are measured on the full resolution source, which is a complete pass
 * over the image. Without a cache, dragging the stretch slider would re-measure
 * every channel on every preview refresh - seconds per keystroke on a large
 * frame - even though neither statistic depends on the slider.
 */
var fxStatsCache = {};


function fxClearStatsCache()
{
   fxStatsCache = {};
}

function fxChannelStats( view )
{
   let id = view.id;
   if ( fxStatsCache[id] != undefined )
      return fxStatsCache[id];

   let image = view.image;
   let median = image.median();
   if ( !isFinite( median ) )
   {
      // fxClamp passes NaN straight through - NaN < lo and NaN > hi are both
      // false - so an unchecked NaN median would reach the expression writer.
      Console.warningln( "Channel normalization: " + id + " has a non-finite median, most "
                       + "likely NaN borders from registration. The channel will be left "
                       + "as it is." );
      median = 0;
   }
   let madn = 0;

   try
   {
      madn = image.MAD() * 1.4826;
   }
   catch ( x )
   {
      madn = 0;
   }
   if ( !isFinite( madn ) || madn <= 0 )
   {
      try
      {
         madn = image.stdDev();
      }
      catch ( x )
      {
         madn = 0;
      }
   }

   let minimum = 0;
   try
   {
      minimum = image.minimum();
   }
   catch ( x )
   {
      minimum = 0;
   }
   if ( !isFinite( minimum ) )
      minimum = 0;

   let stats = { median: median, madn: madn, minimum: minimum };
   fxStatsCache[id] = stats;
   return stats;
}

/*
 * -----------------------------------------------------------------------------
 * Channel conditioning
 * -----------------------------------------------------------------------------
 *
 * One black point and one midtones transfer per channel, and it runs only when
 * Channel normalization is on - nothing here conditions a channel otherwise.
 *
 * It follows the published normalization method: the black point is
 * interpolated between the channel's minimum and its median, and the target is
 * the *reference channel's* median times a per-channel boost. Sii and Oiii are
 * lifted to Ha's brightness by a curve stretch rather than a linear scale,
 * which is what stops SHO being overwhelmingly green before a single pixel of
 * colour correction is applied.
 *
 * Note that the target is RELATIVE - it multiplies whatever the reference
 * channel already sits at - so this cannot stand in for a stretch. On linear
 * input the reference median is near zero and every channel stays near zero
 * with it. That is why 3.0.0 withdrew linear support rather than leaning on
 * this stage to cover it.
 *
 * The result is a { c0, m } pair per channel, which is all anything downstream
 * needs to know.
 */

/*
 * Whether anything conditions the channels at all.
 */
function fxConditionsChannels( p )
{
   return p.linearInput || p.normalizeEnabled;
}

/*
 * The black point for one channel, in source units.
 */
function fxBlackPointFor( stats, p )
{
   if ( p.linearInput )
   {
      // PixInsight's own screen transfer rule: the black point sits linearClip
      // MAD sigmas below the median. This is where the unused MAD finally goes.
      let c0 = 0;
      if ( isFinite( stats.madn ) && stats.madn > 0 )
         c0 = fxClamp( stats.median - p.linearClip * stats.madn, 0, 0.999 );

      if ( p.linearMethod == 1 || p.linearNoClip )
      {
         // Statistical stretch, after SetiAstro: never place the black point
         // above the darkest pixel, so nothing is thrown away. It also rescues
         // a channel whose own nebulosity inflates its MAD - on the reference
         // masters Ha's unclipped point lands 2.1e-3 below its floor, which
         // would leave that one channel sitting on a grey pedestal the other
         // two do not have.
         let floorValue = fxClamp( stats.minimum, 0, 0.999 );
         if ( p.linearNoClip || c0 < floorValue )
            c0 = floorValue;
      }
      return c0;
   }

   if ( p.normalizeEnabled )
   {
      // Interpolated from the minimum towards the median, as the module's
      // shadow point parameter does.
      let lo = fxClamp( stats.minimum, 0, 0.999 );
      let hi = fxClamp( stats.median, 0, 0.999 );
      if ( hi < lo )
         hi = lo;
      return fxClamp( lo + fxClamp( p.normShadow, 0, 1 ) * (hi - lo), 0, 0.999 );
   }

   return 0;
}

/*
 * The channel's median once the black point has been subtracted and the range
 * rescaled - the value the midtones transfer has to move onto the target.
 */
function fxMedianAfterBlackPoint( stats, c0 )
{
   return (c0 < 1) ? fxClamp( (stats.median - c0) / (1 - c0), 0, 1 ) : 0;
}

function fxNormalizationBoost( p, key )
{
   if ( !p.normalizeEnabled )
      return 1;
   switch ( key )
   {
   case "sii":  return p.normSii;
   case "oiii": return p.normOiii;
   default:     return p.normHa;
   }
}

/*
 * Returns { c0, m } for one channel, or null when it needs no transform.
 *
 * referenceMedian is the reference channel's post-black-point median, already
 * computed by the caller; it is ignored unless normalization is on.
 */
function fxChannelTransform( view, p, key, referenceMedian )
{
   if ( view == null || view.isNull )
      return null;
   if ( !fxConditionsChannels( p ) )
      return null;

   let stats = fxChannelStats( view );
   let c0 = fxBlackPointFor( stats, p );
   // fxStretch only emits the shadow clip above 1e-6, so anything below it must
   // be solved as if it were zero too - otherwise the balance is solved for a
   // clipped input the expression never actually clips, and the background
   // lands several times above target.
   if ( c0 <= 1.0e-6 )
      c0 = 0;
   let xm = fxMedianAfterBlackPoint( stats, c0 );

   // The anchor the boost multiplies. Normalization on its own is a *relative*
   // statement - "put Oiii at 0.8x of Ha" - and multiplies whatever the
   // reference channel already sits at. The auto stretch supplies an absolute
   // one instead, and when both are on the absolute anchor wins: the two used
   // to exclude each other, so ticking normalization on linear data replaced a
   // target of 0.25 with the reference channel's raw linear median and the
   // result came out 250x darker than either setting alone. The reference
   // channel drops out of the calculation entirely once there is an absolute
   // level to aim at.
   let anchor = p.linearInput ? fxClamp( p.linearTarget, 0.001, 0.999 )
                              : referenceMedian;
   let target = fxClamp( anchor * fxNormalizationBoost( p, key ), 0.001, 0.999 );

   if ( !(xm > 0) )
   {
      // Every path out of here leaves the channel fully linear, which on linear
      // input means black. Saying nothing is what made the original report hard
      // to diagnose.
      Console.warningln( format( "Channel normalization: %s has no signal above its black "
                               + "point (median %.3e, black point %.3e). This channel is left "
                               + "as it is. Lower \"Shadow point\" in the Channel normalization "
                               + "section - or check the channel is stretched, because a linear "
                               + "one lands here every time.",
                                 view.id, stats.median, c0 ) );
      return null;
   }

   let m = fxSolveMTF( xm, target );

   if ( c0 <= 1.0e-6 && Math.abs( m - 0.5 ) < 1.0e-6 )
      return null;
   return { c0: c0, m: m };
}

/*
 * Builds the { sii, ha, oiii } transform map for a set of views.
 */
function fxStretchMapFor( p, siiView, haView, oiiiView )
{
   if ( !fxConditionsChannels( p ) )
      return null;

   // The reference channel sets the median every other channel is moved onto -
   // but only when there is no absolute target to aim at instead.
   let referenceMedian = 0;
   if ( p.normalizeEnabled && !p.linearInput )
   {
      // A palette without Sii must not be normalised to a Sii image left
      // selected from an earlier session.
      let ref = p.normalizeRef;
      if ( ref == 0 && !fxStyle( p ).needsSii )
         ref = 1;
      let refView = (ref == 0) ? siiView : ((ref == 2) ? oiiiView : haView);
      if ( refView == null || refView.isNull )
         refView = haView;
      if ( refView != null && !refView.isNull )
      {
         let refStats = fxChannelStats( refView );
         referenceMedian = fxMedianAfterBlackPoint( refStats, fxBlackPointFor( refStats, p ) );
      }
      if ( !(referenceMedian > 0) )
      {
         // A reference channel with nothing above its black point cannot say
         // where the others belong. Say so and leave every channel alone rather
         // than normalising onto an invented level.
         Console.warningln( "Channel normalization: the reference channel has no signal above "
                          + "its black point, so the channels are left as they are. These "
                          + "images may still be linear - this script needs NON-LINEAR data." );
         return null;
      }
   }

   return {
      sii:  fxChannelTransform( siiView,  p, "sii",  referenceMedian ),
      ha:   fxChannelTransform( haView,   p, "ha",   referenceMedian ),
      oiii: fxChannelTransform( oiiiView, p, "oiii", referenceMedian )
   };
}

/*
 * Per-channel medians of an RGB view, used by the background cast mode.
 */
function fxViewChannelMedians( view )
{
   let out = [ 0.5, 0.5, 0.5 ];
   try
   {
      // Work on a detached copy: the
      // channel selection is never written back to the live view.
      let image = new Image( view.image );
      try
      {
         for ( let c = 0; c < 3 && c < image.numberOfChannels; ++c )
         {
            image.selectedChannel = c;
            let v = image.median();
            out[c] = isFinite( v ) ? v : 0.5;
         }
      }
      finally
      {
         try
         {
            image.free();
         }
         catch ( x )
         {
         }
      }
   }
   catch ( error )
   {
      // Returning three equal medians would make the cast correction a silent
      // no-op, which is indistinguishable from it working. Say so.
      Console.warningln( "Background cast: could not measure the channel medians, "
                       + "stage skipped: " + fxErrorText( error ) );
   }
   return out;
}

/*
 * -----------------------------------------------------------------------------
 * Curve helpers
 * -----------------------------------------------------------------------------
 *
 * The signature curves are scaled towards the identity transform, so a
 * strength of 0 is a genuine no-op, 1 reproduces the original script exactly,
 * and 2 doubles the departure from identity.
 */

function fxScaleCurve( points, k )
{
   let out = [];
   for ( let i = 0; i < points.length; ++i )
   {
      let x = points[i][0];
      let y = points[i][1];
      out.push( [ x, fxClamp( x + k * (y - x), 0.0, 1.0 ) ] );
   }
   return out;
}

function fxScaleDeltaCurve( points, k )
{
   let out = [];
   for ( let i = 0; i < points.length; ++i )
      out.push( [ points[i][0], fxClamp( points[i][1] * k, -1.0, 1.0 ) ] );
   return out;
}

// Signature curves of the original Foraxx Palette Utility.
// Note that CURVE1_H and CURVE2_H are applied to the *hue* channel, which is
// what the original does and is a large part of the palette's character.
var FX_CURVE1_H =
[
   [ 0.00000, 0.00000 ],
   [ 0.02517, 0.05952 ],
   [ 0.07323, 0.08571 ],
   [ 0.11442, 0.13810 ],
   [ 0.62014, 0.67619 ],
   [ 1.00000, 1.00000 ]
];

var FX_CURVE1_S =
[
   [ 0.00000, 0.00000 ],
   [ 0.50801, 0.61667 ],
   [ 1.00000, 1.00000 ]
];

var FX_CURVE2_H =
[
   [ 0.00000, 0.00000 ],
   [ 0.05034, 0.03571 ],
   [ 0.08238, 0.10238 ],
   [ 0.24943, 0.25000 ],
   [ 1.00000, 1.00000 ]
];

var FX_SATURATION_HS =
[
   [ 0.00000,  0.00000 ],
   [ 0.04910,  0.00909 ],
   [ 0.07235,  0.00909 ],
   [ 0.10594,  0.15455 ],
   [ 0.19380,  0.00909 ],
   [ 0.37726,  0.00000 ],
   [ 0.52972,  0.00909 ],
   [ 0.60465,  0.13636 ],
   [ 0.68475, -0.00909 ],
   [ 0.84496,  0.00000 ],
   [ 1.00000,  0.00000 ]
];

/*
 * -----------------------------------------------------------------------------
 * PixelMath wrappers
 * -----------------------------------------------------------------------------
 */

// Said once a run, not once a call: the preview alone builds several images
// per keystroke, and a warning per PixelMath would bury the console.
var __fxSampleFormatWarned = false;

function fxSampleFormat32()
{
   // Always produce 32-bit floating point output. The dynamic factors involve
   // fractional powers, and rounding those into a 16-bit integer container
   // introduces visible banding in the low-signal transition zones.
   if ( typeof PixelMath.f32 != "undefined" )
      return PixelMath.f32;
   // Wider than asked for still honours the invariant, which is "not an integer
   // container" rather than "exactly 32 bits".
   if ( typeof PixelMath.f64 != "undefined" )
      return PixelMath.f64;
   // Last resort, and worth saying out loud. On a 16-bit source this makes
   // every image the run produces a 16-bit integer - the starless, the stars,
   // the dynamic factors, the preview channels - and the transition zones the
   // palette is built around are exactly where that shows.
   if ( !__fxSampleFormatWarned )
   {
      __fxSampleFormatWarned = true;
      Console.warningln( "Floating point output is unavailable in this installation. Images "
                       + "will follow the source format, and 16-bit sources will band in the "
                       + "transition zones." );
   }
   return PixelMath.SameAsTarget;
}

/*
 * Creates a new image.
 *
 * expr : either a single expression string (applied to every channel) or an
 *        array of three per-channel expressions.
 * rgb  : true for an RGB result, false for greyscale.
 */
function fxPixelMathNew( refView, newId, rgb, expr, show, swap )
{
   let single = !(expr instanceof Array);

   let P = new PixelMath;
   P.expression  = single ? expr : expr[0];
   P.expression1 = single ? ""   : expr[1];
   P.expression2 = single ? ""   : expr[2];
   P.expression3 = "";
   P.useSingleExpression = single;
   P.symbols = "";
   P.clearImageCacheAndExit = false;
   P.cacheGeneratedImages = false;
   P.generateOutput = true;
   P.singleThreaded = false;
   P.optimization = true;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = true;
   P.showNewImage = show;
   P.newImageId = newId;
   P.newImageWidth = 0;
   P.newImageHeight = 0;
   P.newImageAlpha = false;
   P.newImageColorSpace = rgb ? PixelMath.RGB : PixelMath.Gray;
   P.newImageSampleFormat = fxSampleFormat32();
   P.executeOn( refView, swap );
   return newId;
}

/*
 * Rewrites an existing RGB image in place.
 */
function fxPixelMathInPlace( view, r, g, b, swap )
{
   let P = new PixelMath;
   P.expression  = r;
   P.expression1 = g;
   P.expression2 = b;
   P.expression3 = "";
   P.useSingleExpression = false;
   P.symbols = "";
   P.clearImageCacheAndExit = false;
   P.cacheGeneratedImages = false;
   P.generateOutput = true;
   P.singleThreaded = false;
   P.optimization = true;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.executeOn( view, swap );
}

/*
 * -----------------------------------------------------------------------------
 * Tone and colour stages
 * -----------------------------------------------------------------------------
 */

/*
 * Curves #1 of the original script carries both a hue curve and a global
 * saturation curve, which are scaled independently here.
 */
function fxApplyCurves1( view, kCurve, kSat, swap )
{
   if ( kCurve <= 0 && kSat <= 0 )
      return;
   let P = new CurvesTransformation;
   if ( kCurve > 0 )
   {
      P.H  = fxScaleCurve( FX_CURVE1_H, kCurve );
      P.Ht = CurvesTransformation.AkimaSubsplines;
   }
   if ( kSat > 0 )
   {
      P.S  = fxScaleCurve( FX_CURVE1_S, kSat );
      P.St = CurvesTransformation.AkimaSubsplines;
   }
   P.executeOn( view, swap );
}

function fxApplyCurves2( view, kCurve, swap )
{
   if ( kCurve <= 0 )
      return;
   let P = new CurvesTransformation;
   P.H  = fxScaleCurve( FX_CURVE2_H, kCurve );
   P.Ht = CurvesTransformation.AkimaSubsplines;
   P.executeOn( view, swap );
}

function fxApplySaturation( view, kSat, swap )
{
   if ( kSat <= 0 )
      return;
   let P = new ColorSaturation;
   P.HS  = fxScaleDeltaCurve( FX_SATURATION_HS, kSat );
   P.HSt = ColorSaturation.AkimaSubsplines;
   P.hueShift = 0.000;
   // The original applies the selective boost twice; keeping both passes means
   // a strength of 1 reproduces its output exactly.
   P.executeOn( view, swap );
   P.executeOn( view, swap );
}

/*
 * Highlight compression with a knee.
 * Nothing below the knee is touched at all, and the correction is applied as a
 * single luminance scale factor so hue and saturation survive intact. Scale
 * invariant, so preview and final agree exactly.
 */
function fxApplyHDRCompression( view, p, swap )
{
   let h = fxBuildHDRCompression( p );
   if ( h == null )
      return;

   let P = new PixelMath;
   P.expression = h.expression;
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = h.symbols;
   P.clearImageCacheAndExit = false;
   P.cacheGeneratedImages = false;
   P.generateOutput = true;
   P.singleThreaded = false;
   P.optimization = true;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.executeOn( view, swap );
}

/*
 * A flat saturation boost across every hue, on top of the selective pass.
 * This is what gives the Warhol style its poster colour.
 */
function fxApplyExtraSaturation( view, amount, swap )
{
   if ( fxIsZero( amount ) )
      return;
   let P = new ColorSaturation;
   P.HS = [
      [ 0.00000, amount ],
      [ 0.50000, amount ],
      [ 1.00000, amount ]
   ];
   P.HSt = ColorSaturation.AkimaSubsplines;
   P.hueShift = 0.000;
   P.executeOn( view, swap );
}

/*
 * Quantises each channel to a small number of levels: flat blocks of colour
 * rather than continuous gradients.
 */
function fxApplyPosterise( view, levels, swap )
{
   if ( levels < 2 )
      return;
   let e = fxBuildPosteriseExpressions( levels );
   fxPixelMathInPlace( view, e.r, e.g, e.b, swap );
}

/*
 * PixInsight's HDRMultiscaleTransform. This one works on spatial scales, so a
 * downsampled preview can only be indicative of the final result.
 */
function fxApplyHDRMT( view, layers, swap )
{
   if ( layers < 1 )
      return { ran: false, layers: 0, why: null };

   let P;
   try
   {
      P = new HDRMultiscaleTransform;
   }
   catch ( error )
   {
      // The constructor is what tells us the process is not in this
      // installation. Everything after it is the process refusing this image,
      // which is a different problem and a different place to go looking.
      Console.warningln( "HDRMultiscaleTransform is not available in this installation, "
                       + "multiscale stage skipped: " + fxErrorText( error ) );
      return { ran: false, layers: 0, why: "unavailable" };
   }

   let used = 0;
   try
   {
      // A dyadic multiscale transform needs roughly 2^n pixels in each
      // dimension. A "Fit" preview of a large frame is often only a few
      // hundred pixels across, and asking for more layers than that throws -
      // which on every slider settle would bury the console in warnings.
      let requested = Math.round( fxClamp( layers, 1, 8 ) );
      let shortSide = Math.min( view.image.width, view.image.height );
      let affordable = Math.max( 1, Math.floor( Math.log( shortSide ) / Math.LN2 ) - 1 );
      used = Math.min( requested, affordable );
      P.numberOfLayers = used;
      P.numberOfIterations = 1;
      P.medianTransform = true;
      P.toLightness = true;
      P.preserveHue = false;
      P.luminanceMask = true;
      P.executeOn( view, swap );
   }
   catch ( error )
   {
      Console.warningln( "HDRMultiscaleTransform failed, multiscale stage skipped: "
                       + fxErrorText( error ) );
      return { ran: false, layers: 0, why: "failed" };
   }
   return { ran: true, layers: used, why: null };
}

/*
 * Large scale unsharp mask, used as a local contrast / structure boost. Also
 * scale dependent.
 */
function fxApplyLocalContrast( view, amount, swap )
{
   if ( amount <= 0 )
      return { ran: false, amount: 0, why: null };

   let P;
   try
   {
      P = new UnsharpMask;
   }
   catch ( error )
   {
      Console.warningln( "UnsharpMask is not available in this installation, local contrast "
                       + "skipped: " + fxErrorText( error ) );
      return { ran: false, amount: 0, why: "unavailable" };
   }

   // UnsharpMask will not accept an amount below 0.10, so what the slider asks
   // for and what the process receives are not the same number.
   let used = fxClamp( amount * 0.8, 0.10, 1.00 );
   try
   {
      P.sigma = 12.00;
      P.amount = used;
      P.useLuminance = true;
      P.executeOn( view, swap );
   }
   catch ( error )
   {
      Console.warningln( "UnsharpMask failed, local contrast skipped: " + fxErrorText( error ) );
      return { ran: false, amount: 0, why: "failed" };
   }
   return { ran: true, amount: used, why: null };
}

/*
 * Black point / midtones / white point, driven by the histogram control.
 * Row 3 of the H matrix is the RGB/K channel.
 */
function fxHistogramTransform( view, lo, hi, mid, swap )
{
   lo = fxClamp( lo, 0, 1 );
   hi = fxClamp( hi, 0, 1 );
   mid = fxClamp( mid, 0.001, 0.999 );

   if ( hi <= lo + 0.0005 )
      return;
   if ( lo < 0.0005 && hi > 0.9995 && Math.abs( mid - 0.5 ) < 0.0005 )
      return;   // identity

   let P = new HistogramTransformation;
   P.H = [
      [ 0.0, 0.5, 1.0, 0.0, 1.0 ],
      [ 0.0, 0.5, 1.0, 0.0, 1.0 ],
      [ 0.0, 0.5, 1.0, 0.0, 1.0 ],
      [ lo,  mid, hi,  0.0, 1.0 ],
      [ 0.0, 0.5, 1.0, 0.0, 1.0 ]
   ];
   P.executeOn( view, swap );
}

/*
 * The extracted luminance carries its own black point, stretch and white point.
 * The histogram under the preview drives the colour image, and it is applied
 * after the layer has already been taken, so without these the layer came out
 * as flat as the data arrived - and then that flat layer was substituted back
 * into the colour image.
 */
function fxApplyLuminanceLevels( view, p, swap )
{
   fxHistogramTransform( view, p.lumLow, p.lumHigh, p.lumMid, swap );
}


/*
 * Each previewable image carries its own levels, and gets only its own. The
 * histogram under the preview edits whichever set belongs to the image on
 * screen; before, it drove the starless image whatever you were looking at, so
 * markers set while examining the stars quietly crushed the nebula.
 */
function fxApplyLevels( view, p, swap )
{
   fxHistogramTransform( view, p.levelsLow, p.levelsHigh, p.levelsMid, swap );
}

function fxApplyStarLevels( view, p, swap )
{
   fxHistogramTransform( view, p.starLevelsLow, p.starLevelsHigh, p.starLevelsMid, swap );
}

/*
 * Green removal, then brightness, then colour - in that order, because a
 * saturation boost on unstretched stars finds very little to boost.
 *
 * Star colour boost defaults to 0. Star brightness defaults to 1.00, which 2.6.1
 * chose deliberately: 3^1 = 3 is a gentle lift that suited the conditioned
 * linear channels of the day and does no harm to an already-stretched star
 * frame. It survives the withdrawal of linear input in 3.0.0 because changing
 * it would move the stars and _combined outputs of every existing process icon.
 *
 * The curve is 3^k, so the slider is far more violent than its range suggests:
 * 243 at k = 5, 6561 at k = 8. That is right for a star image still sitting
 * faint and ruinous for one already stretched, where it drives every core to
 * flat white - 2.4.0 shipped it applied unconditionally at 243 and that is
 * exactly what happened. On non-linear input even the default 1.00 lifts a
 * 0.05 star-frame background to 0.136, which the screen combination carries
 * into _combined as a raised floor. Worth knowing before raising it.
 *
 * Deliberately absent: the per-channel background subtraction this function
 * carried in 2.3.1 to 2.3.5. It was reasoning about a residual pedestal that
 * the published method does not correct, and it was only needed because the
 * stretch was running when it should not have been.
 */
function fxApplyStarFinishing( view, p, swap )
{
   // The stretch, and nothing else. The two-pass green removal and the
   // hue-weighted saturation boost that used to run here were dropped: a star
   // field's green is real broadband colour, and both stages were correcting a
   // combination that no longer needs correcting.
   let stretch = fxBuildStarStretchExpression( p.starStretch );
   if ( stretch == null )
      return;

   let P = new PixelMath;
   P.expression = stretch;
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.createNewImage = false;
   P.generateOutput = true;
   P.rescale = false;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.optimization = true;
   P.executeOn( view, swap );
}
function fxApplyClassicSCNR( view, p, swap )
{
   // Average neutral, always. The per-pixel expression modes and the hue
   // selectivity that used to sit alongside this are gone: they were a second
   // way of doing the same job with more knobs and no better result.
   let method = SCNR.AverageNeutral;

   if ( !fxIsZero( p.scnrGreen ) )
   {
      let P = new SCNR;
      P.amount = fxClamp( p.scnrGreen, 0, 1 );
      P.protectionMethod = method;
      P.colorToRemove = SCNR.Green;
      P.preserveLightness = p.scnrPreserveL;
      P.executeOn( view, swap );
   }

   if ( !fxIsZero( p.scnrMagenta ) )
   {
      let I = new Invert;
      I.executeOn( view, swap );

      let P = new SCNR;
      P.amount = fxClamp( p.scnrMagenta, 0, 1 );
      P.protectionMethod = method;
      P.colorToRemove = SCNR.Green;
      P.preserveLightness = p.scnrPreserveL;
      P.executeOn( view, swap );

      I.executeOn( view, swap );
   }
}

function fxApplyColourSuppression( view, p, swap )
{
   if ( !p.scnrEnabled )
      return;
   if ( fxIsZero( p.scnrGreen ) && fxIsZero( p.scnrMagenta ) )
      return;

   // Green is removed by SCNR directly; magenta is green in the inverse, which
   // is how the stock process is normally used for it.
   fxApplyClassicSCNR( view, p, swap );
}

/*
 * -----------------------------------------------------------------------------
 * Artificial luminance
 * -----------------------------------------------------------------------------
 */

/*
/*
 * The artificial luminance, made the way PixInsight itself makes one:
 * ChannelExtraction in CIE L*a*b*, taking L. That is exactly what
 * Image > Extract > Lightness does, so a layer built here behaves in
 * LRGBCombination, in a mask or in Curves the same way a native one does.
 *
 * ChannelExtraction opens its result as a new window, so the new window has to
 * be found afterwards. It is found by diffing the workspace, not by trusting
 * ImageWindow.activeWindow: the image being extracted from is hidden and was
 * never activated, so "the active window" is whatever the user last touched.
 * Claiming that window would rename one of their own images, hide it, and then
 * force-close it as a temporary - on every keystroke, with auto-preview on.
 */
function fxWindowIds()
{
   let ids = [];
   let windows = ImageWindow.windows;
   for ( let i = 0; i < windows.length; ++i )
      ids.push( windows[i].mainView.id );
   return ids;
}

function fxCreateLuminance( colourId, outId, show )
{
   let src = fxRequireView( colourId );
   let before = fxWindowIds();

   // Not demonstrated by any script this implementation could check against, so
   // both spellings are tried and a missing enumerator is fatal rather than
   // silently defaulting to RGB - which would extract red and call it
   // luminance, and then substitute it into the colour image.
   let space = ChannelExtraction.CIELab;
   if ( space == undefined )
      space = ChannelExtraction.CIELab;
   let fmt = ChannelExtraction.SameAsSource;
   if ( fmt == undefined )
      fmt = ChannelExtraction.SameAsSource;
   if ( space == undefined )
      throw new Error( "This version of PixInsight does not expose ChannelExtraction's "
                     + "CIE L*a*b* colour space, so the artificial luminance cannot be "
                     + "extracted." );

   let P = new ChannelExtraction;
   P.colorSpace = space;
   P.channels = [ [ true, "" ], [ false, "" ], [ false, "" ] ];
   if ( fmt != undefined )
      P.sampleFormat = fmt;
   P.inheritAstrometricSolution = true;
   // Nothing is written to the target, so there is no earlier state to undo to.
   P.executeOn( src, false );

   let after = fxWindowIds();
   let newId = null;
   for ( let i = 0; i < after.length; ++i )
      if ( before.indexOf( after[i] ) < 0 )
      {
         newId = after[i];
         break;
      }
   if ( newId == null )
      throw new Error( "The luminance extraction did not produce an image." );

   let w = ImageWindow.windowById( newId );
   try
   {
      w.mainView.id = outId;
      let id = w.mainView.id;   // PixInsight may have had to uniquify it
      if ( !show )
         w.hide();
      fxRequireView( id );
      return id;
   }
   catch ( error )
   {
      // The caller has not recorded it yet, so nothing else would ever close it.
      try
      {
         w.forceClose();
      }
      catch ( x )
      {
      }
      throw error;
   }
}

/*
 * Substitutes the artificial luminance for the image's own, blended by amount
 * and preserving the colour ratios, so nothing but brightness changes.
 */
function fxApplyLuminance( view, p, lumId, swap )
{
   if ( fxIsZero( p.lumApply ) )
      return;
   let e = fxBuildLuminanceApplyExpressions( p, lumId );
   fxPixelMathInPlace( view, e.r, e.g, e.b, swap );
}

/*
 * -----------------------------------------------------------------------------
 * Validation
 * -----------------------------------------------------------------------------
 *
 * Returns an array of problem descriptions; an empty array means we are ready
 * to run. Checked here rather than at execute time so the dialog can keep the
 * Execute button honest and the preview can fail quietly.
 */
function fxValidate( p )
{
   let problems = [];
   let needed = [];
   let mode = fxStyle( p );

   // Each entry carries the parameter key as well, so a wrapper re-resolved
   // below can be written back to the object the render actually reads.
   needed.push( [ "Ha", p.haView, "haView" ] );
   needed.push( [ "Oiii", p.oiiiView, "oiiiView" ] );
   if ( mode.needsSii )
      needed.push( [ "Sii", p.siiView, "siiView" ] );

   if ( p.makeStars )
   {
      needed.push( [ "Ha stars", p.haStarsView, "haStarsView" ] );
      needed.push( [ "Oiii stars", p.oiiiStarsView, "oiiiStarsView" ] );
      if ( mode.needsSii )
         needed.push( [ "Sii stars", p.siiStarsView, "siiStarsView" ] );
   }

   let ref = null;
   for ( let i = 0; i < needed.length; ++i )
   {
      let name = needed[i][0];
      let view = needed[i][1];

      // Re-resolve by identifier: the user may have closed the window while
      // this dialog was open, leaving us holding a stale wrapper. The fresh
      // wrapper is written back into the parameter object, because the render
      // reads p.*View directly - validating one object and rendering another is
      // how the case this guard was written for came back as a thrown error
      // instead of the validation report it is supposed to produce.
      if ( view != null && !view.isNull )
      {
         view = View.viewById( view.id );
         needed[i][1] = view;
         p[ needed[i][2] ] = view;
      }

      if ( view == null || view.isNull )
      {
         problems.push( "No image selected for " + name + "." );
         continue;
      }

      if ( view.image.numberOfChannels != 1 )
         problems.push( name + " (" + view.id + ") is a colour image; a single channel "
                      + "greyscale image is required." );

      if ( ref == null )
         ref = view;
      else if ( view.image.width != ref.image.width || view.image.height != ref.image.height )
         problems.push( name + " (" + view.id + ") is " + view.image.width + "x" + view.image.height
                      + " but " + ref.id + " is " + ref.image.width + "x" + ref.image.height
                      + "; all channels must share the same geometry." );
   }

   if ( p.baseId.length == 0 )
      problems.push( "The output image name is empty." );
   else if ( !(/^[A-Za-z_][A-Za-z0-9_]*$/).test( p.baseId ) )
      problems.push( "\"" + p.baseId + "\" is not a valid image identifier. Use letters, "
                   + "digits and underscores, and do not start with a digit." );
   else if ( p.baseId.indexOf( FX_TEMP_PREFIX ) == 0 )
      problems.push( "\"" + p.baseId + "\" is reserved. Identifiers starting with "
                   + FX_TEMP_PREFIX + " belong to this script's temporary images and are "
                   + "deleted automatically, so your result would be closed as soon as it "
                   + "was built." );

   return problems;
}

/*
 * -----------------------------------------------------------------------------
 * The pipeline
 * -----------------------------------------------------------------------------
 *
 * ids      : { sii, ha, oiii } identifiers of the starless channels
 * starIds  : { sii, ha, oiii } identifiers of the star channels, or null
 * outBase  : base identifier for the images produced
 * opts     : { starless, stars, combined, factors, show, swap, refView,
 *              luminance, stretch, starStretchMap }
 *
 * Returns { starless, stars, combined, o, ho } - identifiers of everything
 * created, so a caller running a preview can clean up afterwards.
 */
function fxCloseCreated( created )
{
   if ( created == null )
      return;
   const KEYS = [ "combined", "stars", "starless", "o", "ho", "luminance" ];
   for ( let i = 0; i < KEYS.length; ++i )
   {
      fxCloseViewById( created[KEYS[i]] );
      created[KEYS[i]] = null;   // idempotent, so a second call is a no-op
   }

   // A detached Image, not a view: nothing else would ever release it, and a
   // failed render with auto-preview on would leak one per keystroke.
   if ( created.histogramImage != null )
   {
      try
      {
         created.histogramImage.free();
      }
      catch ( x )
      {
      }
      created.histogramImage = null;
   }
}

/*
 * PixelMath returns the identifier we asked for whether or not it managed to
 * use it. Confirming the view exists keeps a failure attributable, and keeps
 * fxCloseCreated able to reclaim what was actually built.
 */
function fxRequireView( id )
{
   let v = View.viewById( id );
   if ( v == null || v.isNull )
      throw new Error( "PixelMath did not create \"" + id + "\"." );
   return v;
}

/*
 * Stage one: everything up to but not including the levels transform and the
 * screen combination. The preview grabs the starless image here to build its
 * histogram, so the triangles are always read against the image the levels
 * transform is about to be applied to, not against its own output.
 */

function fxRenderParts( p, ids, starIds, outBase, opts )
{
   let show = opts.show;
   let swap = opts.swap;
   let refView = opts.refView;
   let created = { starless: null, stars: null, combined: null,
                   o: null, ho: null, luminance: null, base: null,
                   // What the optional stages actually did, for the console
                   // report. A stage that was skipped or that failed must not
                   // be printed as though it had run: the report is the record
                   // a run is reproduced from.
                   ranHdrLayers: 0, ranLocalContrast: 0,
                   // A detached copy of whichever image the histogram is meant
                   // to describe, taken before that image's own levels. Only
                   // the preview asks for it, and only the preview frees it.
                   histogramImage: null };

   // Takes the copy at the moment the named image exists but has not been
   // levelled yet. The luminance is levelled inside this function, before the
   // substitution, so it has to be captured here rather than by the caller.
   let capture = function( which, id )
   {
      if ( opts.histogramOf != which || id == null || created.histogramImage != null )
         return;
      try
      {
         let vh = View.viewById( id );
         if ( vh != null && !vh.isNull )
            created.histogramImage = new Image( vh.image );
      }
      catch ( x )
      {
      }
   };

   try
   {
      let needStarless = opts.starless || opts.combined;
      let needStars = (opts.stars || opts.combined) && starIds != null;

      let base = fxUniqueBaseId( outBase );
      created.base = base;

      let maskCtx = { sii: ids.sii, ha: ids.ha, oiii: ids.oiii,
                      stretch: opts.stretch || null };
      let e = fxBuildExpressions( p, maskCtx, maskCtx );

      if ( opts.factors )
      {
         // Named from the group base rather than as a bare "o" / "ho", which
         // would squat on the global identifier namespace every later
         // PixelMath expression resolves against.
         if ( e.o != null )
            created.o = fxPixelMathNew( refView, base + "_o", false, e.o, show, swap );
         if ( e.ho != null )
            created.ho = fxPixelMathNew( refView, base + "_ho", false, e.ho, show, swap );
      }

      if ( needStarless )
      {
         created.starless = fxPixelMathNew( refView, base, true, [ e.r, e.g, e.b ], show, swap );
         let v = fxRequireView( created.starless );

         if ( p.hdrEnabled )
         {
            fxApplyHDRCompression( v, p, swap );
            created.ranHdrLayers = fxApplyHDRMT( v, p.hdrLayers, swap ).layers;
         }
         fxApplyCurves1( v, p.curveStrength, p.satStrength, swap );
         fxApplyCurves2( v, p.curveStrength, swap );
         fxApplySaturation( v, p.satStrength, swap );
         fxApplyExtraSaturation( v, p.extraSaturation, swap );
         fxApplyColourSuppression( v, p, swap );

         if ( p.makeLuminance || opts.luminance )
         {
            // opts.luminance is the preview asking for the layer on its own,
            // without the section being switched on.
            created.luminance = fxCreateLuminance( created.starless, base + "_L", show );
            capture( "luminance", created.luminance );
            // Levelled before the substitution, so what goes back into the
            // colour image is the layer as the user has tuned it.
            fxApplyLuminanceLevels( fxRequireView( created.luminance ), p, swap );
            if ( p.makeLuminance )
               fxApplyLuminance( v, p, created.luminance, swap );
         }

         if ( p.hdrEnabled )
            created.ranLocalContrast = fxApplyLocalContrast( v, p.localContrast, swap ).amount;
         fxApplyPosterise( v, p.posterLevels, swap );
         capture( "starless", created.starless );
      }

      if ( needStars )
      {
         let valueCtx = { sii: starIds.sii, ha: starIds.ha, oiii: starIds.oiii,
                          stretch: opts.starStretchMap || null };

         // Two ways to colour a star field. The Foraxx route reuses the
         // nebula's dynamic masks; the NB to RGB route uses the broadband-style
         // broadband-style combination, which gives far more
         // believable star colour because stars are not line emitters.
         // One combination. Running the nebula's dynamic masks
         // over a star field was the other option here; it built its masks from
         // the starless images, where a star's position holds only background,
         // so it amounted to a plain Ha / Oiii / Oiii mapping with extra steps.
         let es = fxBuildStarRGBExpressions( p, valueCtx );

         created.stars = fxPixelMathNew( refView, base + "_stars", true,
                                         [ es.r, es.g, es.b ], show, swap );
         let vs = fxRequireView( created.stars );

         // The combination above decided the colour; the finishing is the same for every frame.
         //
         // The finishing runs up to six processes. The image was created by
         // PixelMath moments ago and has no earlier state to undo back to, so
         // writing a full-frame swap record for each step would cost well over
         // a gigabyte on a large frame and buy nothing.
         // Green / magenta suppression is deliberately *not* run here, and
         // neither is anything else. That stage is tuned for the nebula, where
         // green is an artefact of the channel imbalance; a star field's green
         // is real broadband colour and the same correction desaturates it into
         // grey. The combination above and the brightness stretch below are the
         // whole of the star treatment.
         fxApplyStarFinishing( vs, p, false );
         capture( "stars", created.stars );
      }

      return created;
   }
   catch ( error )
   {
      // Never leave half a render behind: a failing parameter combination with
      // auto-preview on would otherwise leak one hidden image per keystroke.
      fxCloseCreated( created );
      throw error;
   }
}

/*
 * Stage two: the levels transform on the starless image, then the screen
 * combination, which must happen after it.
 */
function fxRenderFinish( p, created, opts )
{
   let swap = opts.swap;

   try
   {
      if ( created.starless != null )
         fxApplyLevels( View.viewById( created.starless ), p, swap );
      if ( created.stars != null )
         fxApplyStarLevels( View.viewById( created.stars ), p, swap );

      if ( opts.combined && created.starless != null && created.stars != null )
      {
         // A single expression on RGB operands yields an RGB result, one
         // channel at a time, so the screen combination keeps its colour.
         created.combined = fxPixelMathNew( View.viewById( created.starless ),
                                            created.base + "_combined", true,
                                            fxBuildCombineExpression( created.starless, created.stars ),
                                            opts.show, swap );
         fxRequireView( created.combined );
      }
      return created;
   }
   catch ( error )
   {
      fxCloseCreated( created );
      throw error;
   }
}

function fxRender( p, ids, starIds, outBase, opts )
{
   let created = fxRenderParts( p, ids, starIds, outBase, opts );
   return fxRenderFinish( p, created, opts );
}

/*
 * Collects the identifiers a caller passed in, ready for fxRender.
 */
function fxCollectIds( p, stars )
{
   let needsSii = fxStyle( p ).needsSii;
   if ( stars )
   {
      if ( !p.makeStars )
         return null;
      // The star frames take the Sii whenever there is one, whatever the
      // palette. needsSii says what the *nebula* mapping requires, and applying
      // it here threw the Sii away on the HOO palettes: red fell from
      // 0.5*Ha + 0.5*Sii to Ha alone while green and blue kept their Oiii, and
      // the stars came out blue. Stars are broadband sources - the palette
      // decides how the nebula is coloured, not how much data the star field is
      // allowed. Only the channel count can remove it.
      return {
         sii:  (!p.twoChannels && p.siiStarsView) ? p.siiStarsView.id : null,
         ha:   p.haStarsView   ? p.haStarsView.id   : null,
         oiii: p.oiiiStarsView ? p.oiiiStarsView.id : null
      };
   }
   return {
      sii:  needsSii ? (p.siiView ? p.siiView.id : null) : null,
      ha:   p.haView  ? p.haView.id  : null,
      oiii: p.oiiiView ? p.oiiiView.id : null
   };
}

/*
 * Auto-stretch parameters are always measured on the full resolution source
 * views, never on the downsampled preview copies, so the preview and the final
 * image are stretched identically.
 */
/*
 * The channel conditioning map: one black point and one midtones balance per
 * channel.
 *
 * The star frames need care. Solving them their *own* balance is what broke
 * linear input: a star-only frame is almost entirely empty background with a
 * sparse population of peaks, so its median IS that background. An auto stretch
 * that puts a median on 0.25 therefore lifts the void to mid grey and drives
 * every star to 0.92 and above; the screen combination, ~(~a * ~b), can never
 * go below whichever input is brighter, so the finished image ended up on a
 * 0.25 grey floor under flat white stars.
 *
 * Taking the nebula's map wholesale is wrong the other way. Its black point
 * removes a sky pedestal the star frame no longer has, so it subtracts the sky
 * twice and every faint star clips to zero.
 *
 * What is shared is the *curve* and what is measured per frame is the *black
 * point*: the curve keeps the two frames on one brightness scale, which is what
 * the screen combination needs, and the black point handles whichever pedestal
 * convention the star removal left behind. Measured on realistic linear data,
 * a star frame background of 1.5e-5 comes out at 0.018 and a faint star at
 * 5e-4 comes out at 0.37 - dark sky, visible stars.
 */
/*
 * Whether the selected channels look like they are still linear.
 *
 * A stretched narrowband frame has a sky background somewhere around 0.05 to
 * 0.3; a linear one is one to three orders of magnitude below that. This script
 * takes NON-LINEAR data only, so a frame that looks linear is worth saying out
 * loud rather than letting the user wonder why the preview is black.
 */
function fxLooksLinear( p )
{
   let views = [ p.siiView, p.haView, p.oiiiView ];
   let seen = false;
   for ( let i = 0; i < views.length; ++i )
   {
      let v = views[i];
      if ( v == null || v.isNull )
         continue;
      try
      {
         if ( fxChannelStats( v ).median > 0.02 )
            return false;
         seen = true;
      }
      catch ( x )
      {
         return false;
      }
   }
   return seen;
}

function fxCollectStretch( p, stars )
{
   if ( !fxConditionsChannels( p ) )
      return null;

   let map = fxStretchMapFor( p, p.siiView, p.haView, p.oiiiView );
   if ( !stars || map == null )
      return map;
   if ( !p.makeStars )
      return null;

   let views = { sii: p.siiStarsView, ha: p.haStarsView, oiii: p.oiiiStarsView };
   let out = { sii: null, ha: null, oiii: null };

   // One curve for all three star channels, and it is always the Ha one.
   //
   // Per channel is right for the nebula, where the whole point is to rebalance
   // line emission of very different strengths. It is wrong for stars: they are
   // broadband sources, so the relative flux between the frames IS the colour,
   // and lifting each channel by a different amount destroys it. Measured on
   // the reference masters in HOO, where red carries only Ha and so nothing
   // balances the Oiii lift - mean R/G/B 0.0144 / 0.0215 / 0.0245, blue 70%
   // above red, a blue star field. Sharing one curve puts it at 0.0320 / 0.0268
   // / 0.0245, the mild warmth a real population has.
   //
   // Ha rather than the reference channel, for two reasons: the star colour
   // then does not move when the Reference combo does, and Ha's curve is the
   // gentler one, which matters because the transfer compresses highlights and
   // a harder curve pulls the three channels together into a greyer field.
   let sharedM = (map.ha != null) ? map.ha.m : null;
   for ( let key in out )
   {
      if ( map[key] == null )
         continue;
      // The 2.6.1 rule, and it is what makes linear input survivable. A star
      // frame is almost entirely empty background, so its median IS that
      // background: solving it its own stretch puts the void on the target and
      // drives every star past 0.99, and the screen combination then cannot go
      // below that floor. Measured on the reference masters: the void reaches
      // 0.25 and the combined background 0.4375 that way, against 0.0002 and
      // 0.2501 with the curve shared. So the midtones curve comes from the
      // nebula and only the black point is measured per frame - the nebula's
      // would subtract a sky pedestal the star frame no longer has.
      let view = views[key];
      let c0 = map[key].c0;
      if ( view != null && !view.isNull )
      {
         c0 = fxBlackPointFor( fxChannelStats( view ), p );
         // Matches fxChannelTransform: below this the expression writer does not
         // emit the clip at all, so it has to be solved as zero too.
         if ( c0 <= 1.0e-6 )
            c0 = 0;
      }
      out[key] = { c0: c0, m: (sharedM != null) ? sharedM : map[key].m };
   }
   return out;
}

/*
 * The Execute path: full resolution, visible results, undo enabled.
 */
function fxRenderFinal( p )
{
   // The final render must measure the sources as they are right now, not as
   // they were when the preview last looked at them.
   fxClearStatsCache();

   let ids = fxCollectIds( p, false );
   let starIds = fxCollectIds( p, true );

   return fxRender( p, ids, starIds, p.baseId, {
      starless:    true,
      stars:       starIds != null,
      combined:    p.makeCombined && starIds != null,
      factors:     p.makeFactors,
      show:        true,
      swap:        true,
      refView:     p.haView,
      stretch:     fxCollectStretch( p, false ),
      starStretchMap: fxCollectStretch( p, true )
   } );
}

#endif   // __FX_Processing_js
