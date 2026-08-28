// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Splitter_js
#define __FX_Splitter_js

/*
 * *****************************************************************************
 *
 * FXSplitter.js - draggable panel dividers.
 * Part of Foraxx Palette Studio.
 *
 * PJSR has no splitter widget, so this is a thin Control that reports drag
 * deltas. The dialog turns those into a fixed width on the side bar or a fixed
 * height on the histogram. A fixed size is deliberate: a minimum can still be
 * squeezed by a sizer under pressure, which is how control labels ended up
 * truncated, whereas a fixed size cannot.
 *
 * *****************************************************************************
 */

#include <pjsr/StdCursor.jsh>
#include <pjsr/ButtonCodes.jsh>

/*
 * horizontal = true  : a vertical bar you drag left and right
 * horizontal = false : a horizontal bar you drag up and down
 *
 * Set onDrag = function( delta ) to receive the movement in physical pixels,
 * and onDoubleClick to reset.
 */
function FXSplitter( parent, horizontal )
{
   this.__base__ = Control;
   this.__base__( parent );

   let ctrl = this;

   this.horizontal = horizontal;
   this.dragging = false;
   this.anchor = 0;
   this.hover = false;
   this.onDragBegin = null;
   this.onDrag = null;        // receives the offset from the press point
   this.onReset = null;

   let thickness = this.logicalPixelsToPhysical( 6 );
   if ( horizontal )
      this.setFixedWidth( thickness );
   else
      this.setFixedHeight( thickness );

   this.cursor = new Cursor( horizontal ? StdCursor_HorizontalSplit
                                        : StdCursor_VerticalSplit );
   this.toolTip = horizontal
      ? "<p>Drag to widen or narrow the side bar. Double click to restore the default width.</p>"
      : "<p>Drag to make the histogram taller or shorter. Double click to restore the default "
        + "height.</p>";

   /*
    * The anchor is kept in screen coordinates and the reported delta is the
    * absolute offset from the press point. Local coordinates would not do:
    * the splitter itself moves as the panel resizes, so a local delta is only
    * self-correcting if the relayout beats the next mouse-move event. Under a
    * fast drag the deltas would otherwise compound and the panel would snap
    * straight to its clamp.
    */
   this.onMousePress = function( x, y, button, buttons, modifiers )
   {
      if ( button != MouseButton_Left )
         return;
      ctrl.dragging = true;
      let g = ctrl.localToGlobal( new Point( x, y ) );
      ctrl.anchor = ctrl.horizontal ? g.x : g.y;
      if ( ctrl.onDragBegin instanceof Function )
         ctrl.onDragBegin();
   };

   this.onMouseMove = function( x, y, buttons, modifiers )
   {
      if ( !ctrl.dragging )
         return;
      let g = ctrl.localToGlobal( new Point( x, y ) );
      let delta = (ctrl.horizontal ? g.x : g.y) - ctrl.anchor;
      if ( ctrl.onDrag instanceof Function )
         ctrl.onDrag( delta );
   };

   this.onMouseRelease = function( x, y, button, buttons, modifiers )
   {
      ctrl.dragging = false;
   };

   this.onMouseDoubleClick = function( x, y, button, buttons, modifiers )
   {
      if ( ctrl.onReset instanceof Function )
         ctrl.onReset();
   };

   this.onEnter = function()
   {
      ctrl.hover = true;
      ctrl.update();
   };

   this.onLeave = function()
   {
      ctrl.hover = false;
      ctrl.update();
   };

   this.onPaint = function( x0, y0, x1, y1 )
   {
      let g = new Graphics( this );
      try
      {
         let w = this.width;
         let h = this.height;
         g.fillRect( 0, 0, w, h, new Brush( ctrl.hover ? 0xff6f6f6f : 0xff3c3c3c ) );

         // A short grip in the middle, so it reads as something you can grab.
         let grip = new Brush( 0xff9a9a9a );
         if ( ctrl.horizontal )
         {
            let cx = Math.floor( w / 2 );
            let top = Math.floor( h / 2 ) - ctrl.logicalPixelsToPhysical( 12 );
            for ( let i = 0; i < 5; ++i )
               g.fillRect( cx, top + i * ctrl.logicalPixelsToPhysical( 6 ),
                           cx + 1, top + i * ctrl.logicalPixelsToPhysical( 6 )
                                 + ctrl.logicalPixelsToPhysical( 3 ), grip );
         }
         else
         {
            let cy = Math.floor( h / 2 );
            let left = Math.floor( w / 2 ) - ctrl.logicalPixelsToPhysical( 12 );
            for ( let i = 0; i < 5; ++i )
               g.fillRect( left + i * ctrl.logicalPixelsToPhysical( 6 ), cy,
                           left + i * ctrl.logicalPixelsToPhysical( 6 )
                                + ctrl.logicalPixelsToPhysical( 3 ), cy + 1, grip );
         }
      }
      catch ( x )
      {
      }
      g.end();
   };
}

FXSplitter.prototype = new Control;

#endif   // __FX_Splitter_js
