// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Preview_js
#define __FX_Preview_js

/*
 * *****************************************************************************
 *
 * FXPreview.js - the preview control and the preview engine.
 * Part of Foraxx Palette Studio.
 *
 * The engine keeps a set of downsampled, hidden copies of the selected
 * channels and runs the real pipeline on them. Because the pipeline is
 * identical to the one the Execute button uses, the only difference between
 * the preview and the finished image is spatial sampling.
 *
 * *****************************************************************************
 */

#include <pjsr/StdCursor.jsh>
#include <pjsr/FrameStyle.jsh>

#include "FXProcessing.js"

/*
 * -----------------------------------------------------------------------------
 * A scrollable, pannable preview panel
 * -----------------------------------------------------------------------------
 */

class FXPreviewControl extends ScrollBox
{
   constructor( parent )
   {
      super( parent );

      let ctrl = this;

      this.autoScroll = true;
      this.tracking = true;
      this.displayImage = null;
      this.cachedBitmap = null;  // the 1:1 render, scaled by the Graphics transform
      this.displayZoom = 1;      // pure display scale; never triggers a render
      this.fitToPanel = true;
      this.dragging = false;
      this.dragOrigin = new Point( 0, 0 );

      // Continuous zoom: a
      // fixed multiplier per wheel notch rather than a list of fixed steps, and
      // 1.25 * 0.8 = 1 exactly, so a notch in and a notch back out returns to where
      // it started instead of drifting.
      this.minZoom      = 0.10;
      this.maxZoom      = 10.00;
      this.zoomInStep   = 1.25;
      this.zoomOutStep  = 0.80;

      this.viewport.cursor = new Cursor( StdCursor_OpenHand );

      this.setImage = function( image )
      {
         // A 1:1 preview of a large frame is hundreds of megabytes. Release the
         // previous copy explicitly rather than waiting for the garbage
         // collector to notice.
         if ( this.displayImage != null && this.displayImage != image )
         {
            try
            {
               this.displayImage.free();
            }
            catch ( x )
            {
            }
         }
         this.displayImage = image;
         this.cachedBitmap = null;
         this.initScrollBars();
         this.viewport.update();
      };

      /*
       * The zoom is applied when the image is painted, not when it is produced.
       * Changing it scales the bitmap already in hand, so it costs a repaint
       * rather than a full run of the pipeline.
       */
      this.effectiveZoom = function()
      {
         let image = this.displayImage;
         if ( image == null || image.width <= 0 || image.height <= 0 )
            return 1;
         if ( !this.fitToPanel )
            return this.displayZoom;
         let zx = this.viewport.width / image.width;
         let zy = this.viewport.height / image.height;
         let z = Math.min( zx, zy );
         return (z > 0 && isFinite( z )) ? z : 1;
      };

      this.setZoom = function( zoom, fit )
      {
         this.fitToPanel = !!fit;
         if ( !this.fitToPanel && zoom > 0 )
            this.displayZoom = fxClamp( zoom, this.minZoom, this.maxZoom );
         this.initScrollBars();
      };

      this.scaledSize = function()
      {
         return this.sizeAtZoom( this.effectiveZoom() );
      };

      this.sizeAtZoom = function( z )
      {
         let image = this.displayImage;
         if ( image == null || image.width <= 0 || image.height <= 0 )
            return { w: 0, h: 0, z: 1 };
         return { w: Math.max( 1, Math.round( image.width * z ) ),
                  h: Math.max( 1, Math.round( image.height * z ) ),
                  z: z };
      };

      /*
       * Where the top-left image pixel is drawn, before scrolling. An image
       * smaller than the panel is centred, so the anchor maths has to know about
       * that offset - without it, zooming into a fitted image drifts sideways.
       */
      this.originAtZoom = function( z )
      {
         let size = this.sizeAtZoom( z );
         return new Point( Math.floor( Math.max( 0, (this.viewport.width  - size.w) / 2 ) ),
                           Math.floor( Math.max( 0, (this.viewport.height - size.h) / 2 ) ) );
      };

      this.scrollLimitsAtZoom = function( z )
      {
         let size = this.sizeAtZoom( z );
         return new Point( Math.max( 0, size.w - this.viewport.width  ),
                           Math.max( 0, size.h - this.viewport.height ) );
      };

      this.initScrollBars = function()
      {
         let size = this.scaledSize();
         if ( size.w <= 0 || size.h <= 0 )
         {
            this.setHorizontalScrollRange( 0, 0 );
            this.setVerticalScrollRange( 0, 0 );
            this.scrollPosition = new Point( 0, 0 );
         }
         else
         {
            let mx = Math.max( 0, size.w - this.viewport.width  );
            let my = Math.max( 0, size.h - this.viewport.height );
            this.setHorizontalScrollRange( 0, mx );
            this.setVerticalScrollRange(   0, my );
            // A smaller view must not keep a scroll offset from a larger one.
            let sp = this.scrollPosition;
            this.scrollPosition = new Point( Math.min( sp.x, mx ), Math.min( sp.y, my ) );
         }
         this.viewport.update();
      };

      /*
       * Multiplies the zoom about a point in the panel, keeping whatever image
       * pixel is under that point exactly where it is. Pass the cursor position
       * for the wheel, or the centre of the panel for a button.
       *
       * Returns true if the zoom actually changed, so the caller only writes back
       * to the parameter store and repaints the status line when something moved.
       */
      this.zoomAbout = function( x, y, factor )
      {
         let image = this.displayImage;
         if ( image == null || image.width <= 0 || image.height <= 0 )
            return false;

         let z0 = this.effectiveZoom();
         // In Fit the scale is whatever the panel dictates, and on a large frame
         // at 1:1 detail that can be below minZoom - a 9576 px frame in a 900 px
         // panel fits at 0.094. Clamping the notch into the fixed range regardless
         // would move the zoom the *opposite* way to the wheel and then dead-end,
         // so the current scale is allowed to widen the window it is clamped into.
         let lo = Math.min( this.minZoom, z0 );
         let hi = Math.max( this.maxZoom, z0 );
         let z1 = fxClamp( z0 * factor, lo, hi );
         // At a limit the notch does nothing - which is the right answer when the
         // whole frame is already in the panel - and Fit must survive that, or a
         // wheel-out at the fit limit would silently drop the panel out of Fit at
         // the same scale and stop tracking the panel size.
         if ( Math.abs( z1 - z0 ) < 1.0e-9 )
            return false;

         // Which image pixel is under the pointer right now.
         let o0 = this.originAtZoom( z0 );
         let sp = this.scrollPosition;
         let ix = (x - o0.x + sp.x) / z0;
         let iy = (y - o0.y + sp.y) / z0;

         // Leaving Fit has to happen before the ranges are recomputed, or they are
         // still the fitted ones.
         this.fitToPanel = false;
         this.displayZoom = z1;

         let size = this.sizeAtZoom( z1 );
         let mx = Math.max( 0, size.w - this.viewport.width  );
         let my = Math.max( 0, size.h - this.viewport.height );
         this.setHorizontalScrollRange( 0, mx );
         this.setVerticalScrollRange(   0, my );

         // Put that same image pixel back under the pointer. Where the image no
         // longer fills the panel the limits collapse to zero and it is centred
         // instead, which is the only sensible answer there.
         let o1 = this.originAtZoom( z1 );
         this.scrollPosition = new Point(
            Math.round( fxClamp( o1.x + ix*z1 - x, 0, mx ) ),
            Math.round( fxClamp( o1.y + iy*z1 - y, 0, my ) ) );

         this.viewport.update();
         return true;
      };

      /*
       * Zooms about the middle of the panel. What the buttons use.
       */
      this.zoomAboutCentre = function( factor )
      {
         return this.zoomAbout( this.viewport.width/2, this.viewport.height/2, factor );
      };

      // The dialog replaces this handler, because a resize also changes the Auto
      // render sampling and the Fit readout, neither of which the control knows
      // about. It is kept so the control is still correct on its own.
      this.viewport.onResize = function()
      {
         ctrl.initScrollBars();
      };

      this.onHorizontalScrollPosUpdated = function( x )
      {
         ctrl.viewport.update();
      };

      this.onVerticalScrollPosUpdated = function( y )
      {
         ctrl.viewport.update();
      };

      this.viewport.onMousePress = function( x, y, button, buttons, modifiers )
      {
         ctrl.viewport.cursor = new Cursor( StdCursor_ClosedHand );
         ctrl.dragOrigin.x = x;
         ctrl.dragOrigin.y = y;
         ctrl.dragging = true;
      };

      this.viewport.onMouseMove = function( x, y, buttons, modifiers )
      {
         if ( ctrl.dragging )
         {
            let lim = ctrl.scrollLimitsAtZoom( ctrl.effectiveZoom() );
            let sp = new Point( ctrl.scrollPosition )
                        .translatedBy( ctrl.dragOrigin.x - x, ctrl.dragOrigin.y - y );
            // Panning must not be able to push the image out of the panel.
            ctrl.scrollPosition = new Point( fxClamp( sp.x, 0, lim.x ),
                                             fxClamp( sp.y, 0, lim.y ) );
            ctrl.dragOrigin.x = x;
            ctrl.dragOrigin.y = y;
            ctrl.viewport.update();
         }
      };

      this.viewport.onMouseRelease = function( x, y, button, buttons, modifiers )
      {
         ctrl.viewport.cursor = new Cursor( StdCursor_OpenHand );
         ctrl.dragging = false;
      };

      /*
       * Called after the wheel or a double click has moved the zoom, so the dialog
       * can write the new value back to the parameter store and update its
       * readout. The control owns the zoom; the dialog only mirrors it.
       */
      this.onZoomChanged = null;   // function()

      this.notifyZoom = function()
      {
         if ( this.onZoomChanged instanceof Function )
            this.onZoomChanged();
      };

      /*
       * One notch multiplies the zoom by 1.25 or 0.8 about the cursor. Continuous,
       * not a jump between named steps, and the pixel under the pointer stays
       * under the pointer.
       */
      this.viewport.onMouseWheel = function( x, y, delta )
      {
         if ( delta == 0 )
            return;
         // One detent is 120 units. A wheel that reports several at once should
         // move several steps rather than one; anything smaller than a detent
         // still counts as one, so a device that reports in smaller units is not
         // left with a dead wheel.
         let steps = Math.max( 1, Math.min( 8, Math.round( Math.abs( delta ) / 120 ) ) );
         let step = (delta > 0) ? ctrl.zoomInStep : ctrl.zoomOutStep;
         if ( ctrl.zoomAbout( x, y, Math.pow( step, steps ) ) )
            ctrl.notifyZoom();
      };

      /*
       * Double click anywhere in the panel goes back to Fit - the same gesture the
       * histogram markers use to return to their default.
       */
      this.viewport.onMouseDoubleClick = function( x, y, button, buttons, modifiers )
      {
         ctrl.dragging = false;
         ctrl.viewport.cursor = new Cursor( StdCursor_OpenHand );
         if ( ctrl.fitToPanel )
            return;
         ctrl.setZoom( 1, true );
         ctrl.notifyZoom();
      };

      this.viewport.onPaint = function( x0, y0, x1, y1 )
      {
         // Constructed inside the try: if Graphics itself throws, g is undefined
         // and the g.end() below would throw a second time out of a paint handler,
         // which is precisely what the catch is here to prevent.
         let g = null;
         try
         {
            g = new Graphics( this );
            g.fillRect( x0, y0, x1, y1, new Brush( 0xff1b1b1b ) );

            let image = ctrl.displayImage;
            let size = ctrl.scaledSize();
            if ( image != null && size.w > 0 && size.h > 0 )
            {
               // Render once at 1:1 and let the Graphics transform do the zoom.
               // Scaling each update region separately would resample boundary
               // pixels from a different neighbourhood every time and leave seams
               // wherever a partial repaint met a previous one.
               if ( ctrl.cachedBitmap == null )
                  ctrl.cachedBitmap = image.render();

               let z = size.z;
               let dx = Math.floor( Math.max( 0, (this.width  - size.w) / 2 ) );
               let dy = Math.floor( Math.max( 0, (this.height - size.h) / 2 ) );
               let sp = ctrl.scrollPosition;

               // The translation is applied in the scaled coordinate system, so
               // the screen offset has to be divided by the zoom to come back out
               // as screen pixels.
               g.scaleTransformation( z );
               g.translateTransformation( (dx - sp.x) / z, (dy - sp.y) / z );
               g.drawBitmap( 0, 0, ctrl.cachedBitmap );
            }
         }
         catch ( x )
         {
            // Never let a paint failure take down the dialog.
         }
         if ( g != null )
            g.end();
      };

      this.initScrollBars();
   }
}

/*
 * -----------------------------------------------------------------------------
 * The preview engine
 * -----------------------------------------------------------------------------
 */

function FXPreviewEngine()
{
   this.channelIds = null;      // downsampled starless channels
   this.starIds = null;         // downsampled star channels
   this.starlessKey = "";
   this.starsKey = "";
   this.starlessTemps = [];
   this.starsTemps = [];
   this.factor = 1;
   this.lastError = "";
   // Whether the star channels could be downsampled peak-first. Null until the
   // first attempt, then true or false; the status line reports it.
   this.starPeaksPreserved = null;
}

FXPreviewEngine.prototype.closeList = function( list )
{
   for ( let i = list.length; --i >= 0; )
      fxCloseViewById( list[i] );
   return [];
};

FXPreviewEngine.prototype.releaseStarless = function()
{
   this.starlessTemps = this.closeList( this.starlessTemps );
   this.channelIds = null;
   this.starlessKey = "";
};

FXPreviewEngine.prototype.releaseStars = function()
{
   this.starsTemps = this.closeList( this.starsTemps );
   this.starIds = null;
   this.starsKey = "";
};

/*
 * Closes every temporary view created by the engine.
 */
FXPreviewEngine.prototype.release = function()
{
   this.releaseStars();
   this.releaseStarless();
};

/*
 * Chooses the integer downsampling factor the pipeline runs at.
 *
 * This is the *render* sampling, not the zoom: the zoom is a display transform
 * applied to whatever this produces, so changing the zoom never comes back here.
 *
 * detail: 0 = auto, 1 = 1:1, 2 = 1:2, 3 = 1:4, 4 = 1:8
 *
 * Auto renders at twice the panel resolution, so zooming in to 200% is still
 * pixel exact and costs four panel-fulls of memory rather than a whole frame.
 */
FXPreviewEngine.prototype.zoomFactor = function( detail, view, panelWidth, panelHeight )
{
   switch ( detail )
   {
   case 1: return 1;
   case 2: return 2;
   case 3: return 4;
   case 4: return 8;
   default:
      {
         const OVERSAMPLE = 2;
         let w = Math.max( 64, panelWidth ) * OVERSAMPLE;
         let h = Math.max( 64, panelHeight ) * OVERSAMPLE;
         let f = Math.ceil( Math.max( view.image.width / w, view.image.height / h ) );
         return Math.max( 1, Math.min( 64, f ) );
      }
   }
};

/*
 * Produces a hidden, downsampled greyscale copy of a source view.
 *
 * peaks: downsample by taking the brightest pixel of each block rather than
 * their mean. This matters enormously for the star channels and not at all for
 * the nebula ones.
 *
 * A star is a handful of bright pixels in a field of background. Averaging a
 * 1:8 block dilutes a peak of 0.05 down to 0.0033, and the star finishing then
 * multiplies by 3^5 = 243 - a curve steep enough that the diluted value comes
 * out at 0.43 where the real star reaches 0.93. Because the resampling happens
 * *before* the stretch and the stretch is strongly non-linear, f(mean) is
 * nothing like mean(f), and the previewed star field was systematically dimmer
 * than the one Execute produced. Taking the maximum instead recovers the peak
 * exactly; measured worst-case gap falls from 0.60 to 0.0013.
 *
 * Returns { id, peaks } - peaks says whether the request was actually honoured,
 * because IntegerResample's downsample mode is not something this codebase has
 * been able to confirm against a shipping script.
 */
FXPreviewEngine.prototype.makeChannel = function( view, factor, tag, list, peaks )
{
   let id = fxUniqueViewId( FX_TEMP_PREFIX + tag );
   fxPixelMathNew( view, id, false, view.id, false, false );
   list.push( id );

   let honoured = false;
   if ( factor > 1 )
   {
      let w = ImageWindow.windowById( id );
      if ( w != null && !w.isNull )
      {
         let R = new IntegerResample;
         R.zoomFactor = -factor;
         if ( peaks )
         {
            // Attempted, then read back: an unknown property assignment may be
            // ignored rather than raised, and silently averaging while the
            // status line claims otherwise is the one outcome to avoid.
            try
            {
               R.downsampleMode = IntegerResample.Maximum;
               honoured = (R.downsampleMode == IntegerResample.Maximum);
            }
            catch ( x )
            {
               honoured = false;
            }
         }
         R.executeOn( w.mainView, false );
      }
   }
   else
      honoured = peaks ? true : false;   // nothing was resampled, so nothing was lost

   return { id: id, peaks: honoured };
};

/*
 * Rebuilds the downsampled channel sets if the selection or the zoom changed.
 *
 * The starless and star sets are keyed independently, so switching the preview
 * target between Starless and Stars does not throw away three perfectly good
 * starless copies and resample them again.
 */
FXPreviewEngine.prototype.ensureChannels = function( p, factor, needStars )
{
   let needsSii = fxStyle( p ).needsSii;
   let src = fxCollectIds( p, false );
   let srcStars = needStars ? fxCollectIds( p, true ) : null;

   this.factor = factor;

   let starlessKey = [ factor, src.sii, src.ha, src.oiii ].join( "|" );
   if ( starlessKey != this.starlessKey || this.channelIds == null )
   {
      this.releaseStarless();
      // Publish the list BEFORE filling it. It used to be assigned only after
      // all three succeeded, so a throw on the second or third left the first
      // channel's hidden image referenced by nothing the engine could close -
      // and every retry made another one.
      let list = [];
      this.starlessTemps = list;
      this.channelIds = {
         sii:  needsSii ? this.makeChannel( p.siiView, factor, "sii", list, false ).id : null,
         ha:   this.makeChannel( p.haView,   factor, "ha",   list, false ).id,
         oiii: this.makeChannel( p.oiiiView, factor, "oiii", list, false ).id
      };
      this.starlessKey = starlessKey;
   }

   // A render that does not need the stars must leave them alone. Deriving the
   // key from a null source produced a sentinel that never matched, so every
   // starless render released a perfectly valid star set and the next switch
   // back paid three full-resolution duplications and three resamples again.
   // The starless branch was never treated this way; the asymmetry was
   // accidental, and it made the documented independent caching half false.
   if ( srcStars != null )
   {
      let starsKey = [ factor, srcStars.sii, srcStars.ha, srcStars.oiii ].join( "|" );
      if ( starsKey != this.starsKey || this.starIds == null )
      {
         this.releaseStars();
         let list = [];
         this.starsTemps = list;
         let cs = needsSii ? this.makeChannel( p.siiStarsView, factor, "siis", list, true ) : null;
         let ch = this.makeChannel( p.haStarsView,   factor, "has",   list, true );
         let co = this.makeChannel( p.oiiiStarsView, factor, "oiiis", list, true );
         this.starIds = { sii: (cs == null) ? null : cs.id, ha: ch.id, oiii: co.id };
         this.starPeaksPreserved = ch.peaks && co.peaks && (cs == null || cs.peaks);
         this.starsKey = starsKey;
      }
   }

   return true;
};

/*
 * Runs the full pipeline on the downsampled channels.
 *
 * Returns { image, histogramSource } - both detached Images, or null with
 * lastError set. histogramSource is whichever image the target names, as it
 * stands just before that image's own levels transform: the triangles have to
 * be read against the thing they act on, and each image has its own set.
 */
FXPreviewEngine.prototype.render = function( p, detail, panelWidth, panelHeight )
{
   this.lastError = "";

   let problems = fxValidate( p );
   if ( problems.length > 0 )
   {
      this.lastError = problems[0];
      return null;
   }

   // Complete is the screen combination, so it needs both halves - which is
   // what separates it from the stars target, and why it asks for the starless
   // image as well.
   let wantComplete = (p.previewTarget == 3);
   let wantStars = (p.previewTarget == 1) || wantComplete;
   let wantLum = (p.previewTarget == 2);
   if ( wantStars && !p.makeStars )
   {
      this.lastError = "This preview needs the star images. Untick "
                     + "\"Starless images only\" and select them.";
      return null;
   }

   let outIds = null;
   let image = null;
   let histogramSource = null;

   try
   {
      let factor = this.zoomFactor( detail, p.haView, panelWidth, panelHeight );
      this.ensureChannels( p, factor, wantStars );

      let refView = View.viewById( this.channelIds.ha );
      if ( refView == null || refView.isNull )
      {
         // Do not leave a cache key pointing at views that are gone, or every
         // later refresh short-circuits onto the same dead set and Refresh can
         // never recover.
         this.release();
         this.lastError = "Could not build the downsampled preview channels.";
         return null;
      }

      let opts = {
         // The histogram now follows the target, so a stars preview has no use
         // for the starless image. The luminance target still does - the layer
         // is extracted from it.
         starless:    !wantStars || wantComplete,
         stars:       wantStars,
         combined:    wantComplete,
         luminance:   wantLum,
         // The histogram describes whatever is on screen, so the render takes
         // the copy at the point that image exists but has not been levelled.
         // The combination has no such point - it is built from two images that
         // are already levelled - so Complete takes the starless histogram,
         // which is the set its levels panel edits.
         histogramOf: (p.previewTarget == 1) ? "stars"
                    : ((p.previewTarget == 2) ? "luminance" : "starless"),
         factors:     false,
         show:        false,
         swap:        false,
         refView:     refView,
         stretch:     fxCollectStretch( p, false ),
         starStretchMap: fxCollectStretch( p, true )
      };

      outIds = fxRenderParts( p, this.channelIds, wantStars ? this.starIds : null,
                              FX_TEMP_PREFIX + "out", opts );

      histogramSource = outIds.histogramImage;
      outIds.histogramImage = null;   // ownership passes to the caller

      fxRenderFinish( p, outIds, opts );

      let id = null;
      switch ( p.previewTarget )
      {
      case 1:  id = outIds.stars; break;
      case 2:  id = outIds.luminance; break;
      case 3:  id = outIds.combined; break;
      default: id = outIds.starless; break;
      }

      let v = (id == null) ? null : View.viewById( id );
      if ( v == null || v.isNull )
         this.lastError = wantLum
            ? "The luminance extraction did not produce an image."
            : (wantComplete
               ? "The screen combination did not produce an image."
               : "The preview did not produce an image.");
      else
         image = new Image( v.image );
   }
   catch ( error )
   {
      this.lastError = "Preview failed: " + fxErrorText( error );
      image = null;
   }

   fxCloseCreated( outIds );

   if ( image == null )
   {
      if ( histogramSource != null )
      {
         try
         {
            histogramSource.free();
         }
         catch ( x )
         {
         }
      }
      return null;
   }
   return { image: image, histogramSource: histogramSource };
};

/*
 * A last-resort sweep for temporaries left behind by an aborted run.
 */
function fxSweepTemporaries()
{
   try
   {
      let windows = ImageWindow.windows;
      for ( let i = windows.length; --i >= 0; )
      {
         let id = windows[i].mainView.id;
         if ( id.indexOf( FX_TEMP_PREFIX ) == 0 )
            windows[i].forceClose();
      }
   }
   catch ( x )
   {
   }
}

#endif   // __FX_Preview_js
