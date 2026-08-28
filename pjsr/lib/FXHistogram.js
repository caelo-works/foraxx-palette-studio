// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Histogram_js
#define __FX_Histogram_js

/*
 * *****************************************************************************
 *
 * FXHistogram.js - histogram computation and the draggable levels control.
 * Part of Foraxx Palette Studio.
 *
 * The control paints an RGB histogram of whichever image the preview is showing as it stands just
 * before the levels transform, with three triangles underneath for the black
 * point, the midtones balance and the white point. Dragging a triangle feeds
 * straight back into the pipeline, so the preview updates with it.
 *
 * Everything is painted with fillRect only. Polygon fills are not used
 * anywhere in the shipping PixInsight scripts, so the triangles are drawn as
 * stacked scanlines rather than relying on an API that may not be there.
 *
 * *****************************************************************************
 */

#include <pjsr/StdCursor.jsh>

#include "FXProcessing.js"

#define FX_HIST_BINS 256

/*
 * Builds a three channel histogram from an Image, on a strided grid so the
 * cost stays flat regardless of the preview size.
 *
 * Returns { bins, c: [r[], g[], b[]], peak, total, median } or null.
 */
function fxComputeHistogram( image )
{
   if ( image == null || image.width <= 0 || image.height <= 0 )
      return null;

   try
   {
      let bins = FX_HIST_BINS;
      let w = image.width;
      let h = image.height;
      let nc = image.numberOfChannels;

      let c = [ [], [], [] ];
      for ( let k = 0; k < 3; ++k )
         for ( let i = 0; i < bins; ++i )
            c[k].push( 0 );

      // Cap the work at roughly 120k pixel reads whatever the image size.
      let step = Math.max( 1, Math.round( Math.sqrt( (w * h) / 120000 ) ) );
      let total = 0;

      for ( let y = 0; y < h; y += step )
         for ( let x = 0; x < w; x += step )
         {
            ++total;
            for ( let k = 0; k < 3; ++k )
            {
               let v = image.sample( x, y, (k < nc) ? k : (nc - 1) );
               if ( !isFinite( v ) )
                  continue;
               let i = Math.floor( v * bins );
               if ( i < 0 ) i = 0;
               else if ( i >= bins ) i = bins - 1;
               ++c[k][i];
            }
         }

      if ( total == 0 )
         return null;

      // Peak excluding the extreme bins: a large black or white clip would
      // otherwise flatten everything else to nothing.
      let peak = 1;
      for ( let k = 0; k < 3; ++k )
         for ( let i = 1; i < bins - 1; ++i )
            if ( c[k][i] > peak )
               peak = c[k][i];

      // Median of the luminance-ish combined distribution, used by Auto.
      let combined = [];
      for ( let i = 0; i < bins; ++i )
         combined.push( c[0][i] + c[1][i] + c[2][i] );
      let half = (total * 3) / 2;
      let acc = 0;
      let median = 0.5;
      for ( let i = 0; i < bins; ++i )
      {
         acc += combined[i];
         if ( acc >= half )
         {
            median = (i + 0.5) / bins;
            break;
         }
      }

      return { bins: bins, c: c, peak: peak, total: total, median: median };
   }
   catch ( error )
   {
      return null;
   }
}

/*
 * Value at which the given fraction of the distribution has accumulated.
 */
function fxHistogramQuantile( hist, fraction )
{
   if ( hist == null )
      return 0;
   let target = hist.total * 3 * fraction;
   let acc = 0;
   for ( let i = 0; i < hist.bins; ++i )
   {
      acc += hist.c[0][i] + hist.c[1][i] + hist.c[2][i];
      if ( acc >= target )
         return i / hist.bins;
   }
   return 1;
}

/*
 * -----------------------------------------------------------------------------
 * The control
 * -----------------------------------------------------------------------------
 */

function FXLevelsControl( parent )
{
   this.__base__ = Control;
   this.__base__( parent );

   let ctrl = this;

   this.histogram = null;
   this.low = 0.0;
   this.mid = 0.5;
   this.high = 1.0;
   this.logScale = true;
   this.dragIndex = -1;
   this.onValueChanged = null;   // function( low, mid, high, finished )

   this.currentCursorId = StdCursor_Arrow;
   this.cursor = new Cursor( StdCursor_Arrow );
   this.setScaledMinSize( 300, 132 );

   /*
    * Only build a Cursor when the shape actually changes; reassigning one on
    * every mouse-move event makes the pointer flicker on some platforms.
    */
   this.setCursorId = function( id )
   {
      if ( this.currentCursorId != id )
      {
         this.currentCursorId = id;
         this.cursor = new Cursor( id );
      }
   };

   this.markerHeight = function()
   {
      return this.logicalPixelsToPhysical( 18 );
   };

   this.padding = function()
   {
      // Wide enough that a marker sitting at 0 or 1 - which is exactly where
      // the black and white points start - is not clipped by the edge.
      return this.logicalPixelsToPhysical( 11 );
   };

   this.valueToX = function( v )
   {
      let pad = this.padding();
      return pad + v * Math.max( 1, this.width - 2 * pad );
   };

   this.xToValue = function( x )
   {
      let pad = this.padding();
      let span = Math.max( 1, this.width - 2 * pad );
      let v = (x - pad) / span;
      return (v < 0) ? 0 : ((v > 1) ? 1 : v);
   };

   this.midPosition = function()
   {
      return this.low + this.mid * (this.high - this.low);
   };

   this.setHistogram = function( image )
   {
      this.histogram = fxComputeHistogram( image );
      this.update();
   };

   this.setValues = function( low, mid, high )
   {
      this.low = low;
      this.mid = mid;
      this.high = high;
      this.update();
   };

   /*
    * A sensible starting point read off the current distribution: clip the
    * black point just below where real signal begins and place the median at
    * a comfortable 0.30.
    */
   this.autoValues = function()
   {
      if ( this.histogram == null )
         return null;

      let low = fxHistogramQuantile( this.histogram, 0.0005 );
      low = Math.max( 0, Math.min( low, 0.9 ) );

      let high = 1.0;
      let median = this.histogram.median;
      let t = (median > low && high > low) ? (median - low) / (high - low) : 0.5;
      let mid = fxSolveMTF( t, 0.30 );

      return { low: low, mid: mid, high: high };
    };

   this.notify = function( finished )
   {
      if ( this.onValueChanged instanceof Function )
         this.onValueChanged( this.low, this.mid, this.high, finished );
   };

   /*
    * Which of the three markers is nearest to x, if any is close enough.
    */
   this.markerAt = function( x )
   {
      let tolerance = this.logicalPixelsToPhysical( 10 );
      let positions = [ this.valueToX( this.low ),
                        this.valueToX( this.midPosition() ),
                        this.valueToX( this.high ) ];

      // Test the midtones marker first and let a later candidate win a tie.
      // Drag the midtones onto the black point with a strict first-wins scan
      // and it can never be picked up again.
      const ORDER = [ 1, 0, 2 ];
      let best = -1;
      let bestDistance = tolerance + 1;
      for ( let j = 0; j < ORDER.length; ++j )
      {
         let i = ORDER[j];
         let d = Math.abs( x - positions[i] );
         if ( d <= bestDistance )
         {
            bestDistance = d;
            best = i;
         }
      }
      return (bestDistance <= tolerance) ? best : -1;
   };

   this.applyDrag = function( x )
   {
      let v = this.xToValue( x );
      const MIN_SPAN = 0.002;

      switch ( this.dragIndex )
      {
      case 0:
         this.low = Math.min( v, this.high - MIN_SPAN );
         if ( this.low < 0 ) this.low = 0;
         break;
      case 2:
         this.high = Math.max( v, this.low + MIN_SPAN );
         if ( this.high > 1 ) this.high = 1;
         break;
      case 1:
         {
            let span = this.high - this.low;
            let m = (span > 0) ? (v - this.low) / span : 0.5;
            this.mid = (m < 0.001) ? 0.001 : ((m > 0.999) ? 0.999 : m);
         }
         break;
      default:
         return;
      }
      this.update();
   };

   this.onMousePress = function( x, y, button, buttons, modifiers )
   {
      ctrl.dragIndex = ctrl.markerAt( x );
      if ( ctrl.dragIndex >= 0 )
      {
         ctrl.setCursorId( StdCursor_ClosedHand );
         ctrl.applyDrag( x );
         ctrl.notify( false );
      }
   };

   this.onMouseMove = function( x, y, buttons, modifiers )
   {
      if ( ctrl.dragIndex >= 0 )
      {
         ctrl.applyDrag( x );
         ctrl.notify( false );
      }
      else
      {
         ctrl.setCursorId( (ctrl.markerAt( x ) >= 0) ? StdCursor_OpenHand : StdCursor_Arrow );
      }
   };

   this.onMouseRelease = function( x, y, button, buttons, modifiers )
   {
      if ( ctrl.dragIndex >= 0 )
      {
         ctrl.dragIndex = -1;
         ctrl.setCursorId( StdCursor_Arrow );
         ctrl.notify( true );
      }
   };

   this.onMouseDoubleClick = function( x, y, button, buttons, modifiers )
   {
      // Double click resets whichever marker is under the pointer.
      let i = ctrl.markerAt( x );
      switch ( i )
      {
      case 0: ctrl.low = 0.0; break;
      case 1: ctrl.mid = 0.5; break;
      case 2: ctrl.high = 1.0; break;
      default: return;
      }
      ctrl.update();
      ctrl.notify( true );
   };

   this.onResize = function( w, h, oldW, oldH )
   {
      ctrl.update();
   };

   /*
    * Filled triangle, pointing up, drawn as stacked scanlines.
    */
   this.paintMarker = function( g, cx, top, height, brush, outline )
   {
      for ( let i = 0; i < height; ++i )
      {
         let halfWidth = Math.round( (i + 1) * 0.62 );
         g.fillRect( cx - halfWidth, top + i, cx + halfWidth + 1, top + i + 1, brush );
      }
      // A one pixel stem so a marker sitting at the very edge stays visible.
      g.fillRect( cx, top - this.logicalPixelsToPhysical( 3 ), cx + 1, top, outline );
   };

   this.onPaint = function( x0, y0, x1, y1 )
   {
      let g = new Graphics( this );
      try
      {
         let w = this.width;
         let h = this.height;
         let pad = this.padding();
         let markerH = this.markerHeight();
         let plotBottom = Math.max( 1, h - markerH );

         let background = new Brush( 0xff1b1b1b );
         let frame = new Brush( 0xff3c3c3c );
         let strip = new Brush( 0xff262626 );

         g.fillRect( 0, 0, w, h, background );
         g.fillRect( 0, plotBottom, w, h, strip );

         // Frame.
         g.fillRect( 0, 0, w, 1, frame );
         g.fillRect( 0, plotBottom - 1, w, plotBottom, frame );
         g.fillRect( 0, h - 1, w, h, frame );
         g.fillRect( 0, 0, 1, h, frame );
         g.fillRect( w - 1, 0, w, h, frame );

         let hist = this.histogram;
         if ( hist != null && hist.peak > 0 )
         {
            let span = Math.max( 1, w - 2 * pad );
            let plotTop = 2;
            let plotHeight = Math.max( 1, plotBottom - 2 - plotTop );
            let logPeak = Math.log( 1 + hist.peak );

            // Outlines rather than filled bars: three curves that stay legible
            // where they overlap. Drawn as a staircase of one pixel vertical
            // segments, so nothing beyond fillRect is needed.
            let brushes = [ new Brush( 0xffff5555 ),
                            new Brush( 0xff45dd6b ),
                            new Brush( 0xff5a97ff ) ];
            let baseline = plotBottom - 2;
            let thickness = Math.max( 1, this.logicalPixelsToPhysical( 1 ) );

            for ( let k = 0; k < 3; ++k )
            {
               let previous = baseline;
               for ( let px = 0; px < span; ++px )
               {
                  // Take the strongest bin falling in this column.
                  let b0 = Math.floor( (px / span) * hist.bins );
                  let b1 = Math.max( b0 + 1, Math.floor( ((px + 1) / span) * hist.bins ) );
                  let v = 0;
                  for ( let b = b0; b < b1 && b < hist.bins; ++b )
                     if ( hist.c[k][b] > v )
                        v = hist.c[k][b];

                  let f = (v <= 0) ? 0
                        : (this.logScale ? (Math.log( 1 + v ) / logPeak) : (v / hist.peak));
                  if ( f > 1 ) f = 1;
                  let y = baseline - Math.round( f * plotHeight );

                  // Connect this column to the previous one so the outline is
                  // continuous through steep changes.
                  let top = Math.min( previous, y );
                  let bottom = Math.max( previous, y ) + thickness;
                  g.fillRect( pad + px, top, pad + px + 1, bottom, brushes[k] );
                  previous = y;
               }
            }
         }

         // Guide lines at the black and white points.
         let guide = new Brush( 0x60ffffff );
         let lowX = Math.round( this.valueToX( this.low ) );
         let highX = Math.round( this.valueToX( this.high ) );
         g.fillRect( lowX, 1, lowX + 1, plotBottom - 1, guide );
         g.fillRect( highX, 1, highX + 1, plotBottom - 1, guide );

         // Markers.
         let markerTop = plotBottom + this.logicalPixelsToPhysical( 4 );
         let markerSize = Math.max( 5, markerH - this.logicalPixelsToPhysical( 6 ) );
         let outline = new Brush( 0xff9a9a9a );

         this.paintMarker( g, lowX, markerTop, markerSize, new Brush( 0xff141414 ), outline );
         this.paintMarker( g, Math.round( this.valueToX( this.midPosition() ) ),
                           markerTop, markerSize, new Brush( 0xff9a9a9a ), outline );
         this.paintMarker( g, highX, markerTop, markerSize, new Brush( 0xfff0f0f0 ), outline );
      }
      catch ( x )
      {
         // A paint failure must never take the dialog down.
      }
      g.end();
   };
}

FXLevelsControl.prototype = new Control;

#endif   // __FX_Histogram_js
