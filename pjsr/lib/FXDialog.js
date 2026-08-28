// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Dialog_js
#define __FX_Dialog_js

/*
 * *****************************************************************************
 *
 * FXDialog.js - the main dialog.
 * Part of Foraxx Palette Studio.
 *
 * *****************************************************************************
 */

#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdCursor.jsh>

#include "FXPreview.js"
#include "FXHistogram.js"
#include "FXSplitter.js"

/*
 * -----------------------------------------------------------------------------
 * Control factories
 * -----------------------------------------------------------------------------
 */

function fxFmt( value, precision )
{
   return Number( value ).toFixed( precision );
}

/*
 * Core icon resources are stable, but a missing one would throw inside the
 * dialog constructor and kill the script before it ever appeared. Assigning
 * them through here degrades to a plain text button instead.
 */
function fxSetIcon( dialog, button, resource, fallbackText )
{
   try
   {
      let bmp = dialog.scaledResource( resource );
      if ( bmp != null && !bmp.isNull )
      {
         button.icon = bmp;
         return true;
      }
   }
   catch ( x )
   {
   }
   if ( fallbackText != null )
      button.text = fallbackText;
   return false;
}

/*
 * A small button that puts one parameter back to its factory default.
 */
function fxResetButton( dialog, parent, toolTipText, onReset )
{
   let btn = new ToolButton( parent );
   fxSetIcon( dialog, btn, ":/icons/undo.png", "↺" );
   btn.setScaledFixedSize( 20, 20 );
   btn.toolTip = toolTipText;
   btn.onClick = onReset;
   return btn;
}

/*
 * A reset button followed by a labelled slider and edit box, wired straight
 * into the parameter store. The tooltip is attached to every part of the row,
 * so hovering the label, the slider, the number box or the reset button all
 * explain the same thing.
 */
function fxNumericRow( dialog, name, labelText, toolTipText, onUpdate )
{
   let range = FXRanges[name];
   // The style in force is the better reference for anything the style itself
   // sets: resetting the Foraxx amount on a fixed palette should put it back to
   // that palette's 0, not to the global 1.00, which would flip it to full
   // dynamic in one click.
   let defaultOf = function()
   {
      let v = fxStyle( FX ).values;
      return (v != null && v[name] !== undefined) ? v[name] : FXDefaults[name];
   };

   let row = new Control( dialog );

   let nc = new NumericControl( row );
   nc.label.text = labelText;
   nc.label.setFixedWidth( dialog.labelWidth );
   nc.setRange( range[0], range[1] );
   nc.slider.setRange( 0, 1000 );
   nc.slider.setScaledMinWidth( 140 );
   nc.setPrecision( range[2] );
   nc.setReal( range[2] > 0 );
   nc.setValue( FX[name] );
   nc.onValueUpdated = onUpdate;

   let tip = toolTipText
           + "<p><i>Range " + fxFmt( range[0], range[2] )
           + " to " + fxFmt( range[1], range[2] )
           + ". The button on the left puts it back to the palette's own starting "
           + "value.</i></p>";

   nc.toolTip = tip;
   nc.label.toolTip = tip;
   nc.slider.toolTip = tip;
   nc.edit.toolTip = tip;
   row.toolTip = tip;

   let btn = fxResetButton( dialog, row, "Reset " + labelText + " to its default.", function()
   {
      let d = defaultOf();
      nc.setValue( d );
      onUpdate( d );
   } );
   btn.toolTip = "Reset to the palette's starting value.<br/>" + toolTipText;

   row.sizer = new HorizontalSizer;
   row.sizer.spacing = 4;
   row.sizer.add( btn );
   row.sizer.add( nc, 100 );

   row.numeric = nc;
   row.setValue = function( v )
   {
      nc.setValue( v );
   };
   return row;
}

function fxCheckBox( parent, text, toolTipText, checked, onCheck )
{
   let cb = new CheckBox( parent );
   cb.text = text;
   cb.toolTip = toolTipText;
   cb.checked = checked;
   cb.onCheck = onCheck;
   return cb;
}

/*
 * A labelled combo box, with the tooltip on both halves.
 */
function fxComboRow( dialog, labelText, items, toolTipText, current, onSelect )
{
   let row = new Control( dialog );

   let label = new Label( row );
   label.text = labelText;
   label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   label.setFixedWidth( dialog.labelWidth );
   label.toolTip = toolTipText;

   let combo = new ComboBox( row );
   for ( let i = 0; i < items.length; ++i )
      combo.addItem( items[i] );
   combo.toolTip = toolTipText;
   combo.currentItem = current;
   combo.onItemSelected = onSelect;

   row.sizer = new HorizontalSizer;
   row.sizer.spacing = 4;
   row.sizer.addSpacing( dialog.logicalPixelsToPhysical( 24 ) );
   row.sizer.add( label );
   row.sizer.add( combo, 100 );

   row.combo = combo;
   row.label = label;
   return row;
}

function fxSection( dialog, title, control, collapsed )
{
   let bar = new SectionBar( dialog, title );
   bar.setSection( control );
   if ( collapsed )
      control.hide();
   return bar;
}

function fxGroupControl( dialog )
{
   let c = new Control( dialog );
   c.sizer = new VerticalSizer;
   c.sizer.margin = 6;
   c.sizer.spacing = 4;
   return c;
}

/*
 * -----------------------------------------------------------------------------
 * The dialog
 * -----------------------------------------------------------------------------
 */

function ForaxxStudioDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   let dlg = this;

   this.windowTitle = TITLE + " " + VERSION;
   this.userResizable = true;

   // One conversion factor, used in both directions, so no assumption is made
   // about a physical-to-logical helper existing.
   this.uiScale = this.logicalPixelsToPhysical( 1000 ) / 1000;

   this.labelWidth = this.font.width( "Highlight compression:" ) + this.logicalPixelsToPhysical( 8 );
   this.viewLabelWidth = this.font.width( "Oiii stars:" ) + this.logicalPixelsToPhysical( 8 );

   this.engine = new FXPreviewEngine;
   this.initialised = false;   // no preview work until the dialog is on screen
   this.rendering = false;     // guards against re-entering a render
   this.didRun = false;        // true once Execute has produced something

   /* ==========================================================================
    * Preview plumbing
    * ========================================================================== */

   this.updateTimer = new Timer;
   this.updateTimer.interval = 0.4;
   this.updateTimer.periodic = false;
   this.updateTimer.onTimeout = function()
   {
      // PixInsight pumps the event loop from inside a running process, so this
      // can fire mid-render. Re-arm rather than re-enter: force-closing a
      // window a process is working on is not survivable.
      if ( dlg.rendering )
      {
         dlg.updateTimer.start();
         return;
      }
      dlg.refreshPreview();
   };

   this.requestPreview = function()
   {
      if ( !this.initialised || !FX.autoPreview )
         return;
      // A notice survives the render it triggers, but not the next thing the
      // user deliberately changes - otherwise "levels reset" would still be on
      // screen ten adjustments later, describing something long since dealt
      // with. setNotice is called after this, so the notice it sets stands.
      this.notice = "";
      this.updateTimer.stop();
      this.updateTimer.start();
   };

   this.refreshPreview = function()
   {
      this.updateTimer.stop();
      if ( !this.initialised || this.rendering )
         return;

      let problems = fxValidate( FX );
      if ( problems.length > 0 )
      {
         this.previewStatus.text = problems[0];
         this.preview.setImage( null );
         this.levels.setHistogram( null );
         return;
      }

      this.rendering = true;
      this.refreshButton.enabled = false;
      this.previewStatus.text = (this.notice.length > 0)
                              ? (this.notice + "  -  rendering preview...")
                              : "Rendering preview...";
      this.cursor = new Cursor( StdCursor_Wait );
      processEvents();

      // processEvents can have closed the dialog. onHide has then already
      // released the channels, and starting a render here would rebuild a set
      // of hidden windows that nothing will ever clean up.
      if ( !this.visible )
      {
         this.rendering = false;
         this.refreshButton.enabled = true;
         this.cursor = new Cursor( StdCursor_Arrow );
         return;
      }

      let result = null;
      try
      {
         result = this.engine.render( FX, FX.previewDetail,
                                      this.preview.viewport.width,
                                      this.preview.viewport.height );
      }
      finally
      {
         this.cursor = new Cursor( StdCursor_Arrow );
         this.refreshButton.enabled = true;
         this.rendering = false;
      }

      if ( result == null )
      {
         this.preview.setImage( null );
         this.previewStatus.text = this.engine.lastError;
      }
      else
      {
         try
         {
            this.preview.setImage( result.image );
            // The control keeps the bin counts, not the pixels.
            this.levels.setHistogram( result.histogramSource );
            this.applyZoom();
         }
         finally
         {
            if ( result.histogramSource != null )
               try
               {
                  result.histogramSource.free();
               }
               catch ( x )
               {
               }
         }
      }
   };

   /*
    * A one-off message that has to outlive the render it triggers.
    *
    * "The levels have been reset", "Created ..." and the rest were written
    * straight to the status label and then overwritten about half a second
    * later by "Rendering preview..." from the refresh they themselves started.
    * The behaviour was implemented, documented and imperceptible. A notice is
    * held here instead and shown until the user does something else.
    */
   this.notice = "";

   this.setNotice = function( text )
   {
      this.notice = text || "";
      if ( this.notice.length > 0 )
         this.previewStatus.text = this.notice;
   };

   /*
    * Everything the status line has to say about what is on screen.
    */
   this.updatePreviewStatus = function()
   {
      let image = this.preview.displayImage;
      if ( image == null )
         return;

      let note = "";
      // A levels set that is not the one on screen is applied at Execute all
      // the same, and nothing else on screen would say so. This is what made a
      // stale black point on the starless image look like the palette itself
      // was broken.
      let elsewhere = fxLevelsInForceElsewhere( FX.previewTarget );
      if ( elsewhere.length > 0 )
         note += "  -  levels also in force on: " + elsewhere.join( ", " );
      // This script takes non-linear data only, and linear channels produce a
      // black preview with no explanation. Say so.
      if ( fxLooksLinear( FX ) )
         note += "  -  THESE CHANNELS LOOK LINEAR. Stretch them first; this script needs "
               + "non-linear images.";
      // Appends, like its two neighbours. A bare assignment here discarded both
      // the capitalised linear-data warning and the off-screen-levels note
      // whenever a multiscale stage was on - silencing, in exactly the
      // configuration where the preview is least trustworthy, the only guard
      // rail left on the one input type this version does not support.
      if ( FX.hdrEnabled && (FX.hdrLayers > 0 || FX.localContrast > 0) )
         note += "  -  multiscale stages are approximate at this sampling";
      // A star's peak is a handful of pixels. If the resampling averaged them
      // away, the brightness stretch has nothing left to lift and the previewed
      // stars come out far dimmer than the ones Execute produces.
      if ( FX.previewTarget == 1 && FX.makeStars
        && this.engine.factor > 1
        && this.engine.starPeaksPreserved === false )
         note += "  -  star peaks are averaged at this sampling, so previewed stars are "
               + "dimmer than the final ones; use Detail 1:1 to judge them";

      let head = (this.notice.length > 0) ? (this.notice + "  -  ") : "";
      this.previewStatus.text = head
                             + format( "%d x %d rendered at 1:%d, shown at %d%%",
                                        image.width, image.height, this.engine.factor,
                                        Math.round( this.preview.effectiveZoom() * 100 ) )
                             + note;
   };

   /* ==========================================================================
    * Header
    * ========================================================================== */

   this.header = new Label( this );
   this.header.useRichText = true;
   this.header.wordWrapping = true;
   this.header.text =
      "<b>" + TITLE + "</b> &nbsp; v" + VERSION + " &nbsp;&mdash;&nbsp; " +
      "dynamic and classic narrowband palettes with a live preview, per-channel weighting, " +
      "adjustable transitions and independent star and luminance control." +
      "<br/><b>SUPPLY NON-LINEAR (STRETCHED) IMAGES.</b> Linear data is not supported: stretch " +
      "each channel before you run this.";
   this.header.minHeight = this.logicalPixelsToPhysical( 42 );

   /* ==========================================================================
    * Data: how many channels, stars or not, and which palette
    * ========================================================================== */

   this.threeChannelRadio = new RadioButton( this );
   this.threeChannelRadio.text = "3 channels (Sii / Ha / Oiii)";
   this.threeChannelRadio.toolTip = "<p>You collected Sii, Ha and Oiii. Every palette is "
                                  + "available.</p>";
   this.threeChannelRadio.onCheck = function( checked )
   {
      if ( !checked || dlg.syncing )
         return;
      fxSetChannelCount( false );
      dlg.pullFromParameters();
      dlg.updateControls();
      dlg.requestPreview();
   };

   this.twoChannelRadio = new RadioButton( this );
   this.twoChannelRadio.text = "2 channels (Ha / Oiii)";
   this.twoChannelRadio.toolTip = "<p>Dual narrowband OSC data, or mono Ha and Oiii only. The Sii "
                                + "rows are disabled, and the palette list is limited to the "
                                + "mappings that do not need Sii.</p>"
                                + "<p>If a Sii palette is selected when you choose this, it moves "
                                + "to the Ha / Oiii equivalent.</p>";
   this.twoChannelRadio.onCheck = function( checked )
   {
      if ( !checked || dlg.syncing )
         return;
      fxSetChannelCount( true );
      dlg.pullFromParameters();
      dlg.updateControls();
      dlg.requestPreview();
   };

   this.starlessOnlyCheck = fxCheckBox( this,
      "Starless only - do not build a stars image",
      "<p>Tick this if your images still contain stars, or if you do not want a separate colour "
      + "stars image. The star columns and the whole Stars section are disabled.</p>",
      !FX.makeStars,
      function( checked )
      {
         FX.makeStars = !checked;
         dlg.updateControls();
         dlg.requestPreview();
      } );

   let dataSizer = new HorizontalSizer;
   dataSizer.spacing = 10;
   dataSizer.add( this.threeChannelRadio );
   dataSizer.add( this.twoChannelRadio );
   dataSizer.addStretch();

   this.styleLabel = new Label( this );
   this.styleLabel.text = "Palette:";
   this.styleLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.styleLabel.setFixedWidth( this.labelWidth );

   this.styleCombo = new ComboBox( this );
   for ( let i = 0; i < FXStyles.length; ++i )
      this.styleCombo.addItem( FXStyles[i].name );
   let styleTip =
      "<p>One list for the palette and its starting point: choosing an entry sets the channel "
      + "mapping, every tuning slider and the output image name at once. You are free to move any "
      + "slider afterwards.</p>"
      + "<p>The <b>Foraxx</b> entries blend red and green between two sources with dynamic "
      + "masks, so the palette changes across the frame. The rest are fixed "
      + "mappings: the three letters give the source of R, G and B in order, so <b>HSO</b> means "
      + "red from Ha, green from Sii, blue from Oiii.</p>"
      + "<p><b>Andy Warhol</b> pushes saturation hard and posterises the result into flat blocks "
      + "of colour, like a screen print.</p>"
      + "<p>Entries that need Sii are hidden while you are in 2 channel mode.</p>";
   this.styleCombo.toolTip = styleTip;
   this.styleLabel.toolTip = styleTip;
   this.styleCombo.onItemSelected = function( index )
   {
      if ( dlg.syncing )
         return;
      let real = dlg.styleIndexFor( index );
      if ( real < 0 )
         return;
      fxApplyStyle( real );
      dlg.pullFromParameters();
      dlg.updateControls();
      dlg.requestPreview();
   };

   /*
    * The combo only lists the styles that work with the current channel count,
    * so these two map between combo rows and FXStyles indices.
    */
   this.styleMap = [];
   this.styleComboTwoChannels = null;

   this.rebuildStyleCombo = function()
   {
      this.syncing = true;
      try
      {
         // Only the channel count changes which styles are listed. Rebuilding
         // the item model on every style selection would mean tearing down the
         // very widget whose activation signal is still on the stack.
         if ( this.styleComboTwoChannels !== FX.twoChannels )
         {
            this.styleComboTwoChannels = FX.twoChannels;
            this.styleCombo.clear();
            this.styleMap = [];
            for ( let i = 0; i < FXStyles.length; ++i )
               if ( !(FX.twoChannels && FXStyles[i].needsSii) )
               {
                  this.styleCombo.addItem( FXStyles[i].name );
                  this.styleMap.push( i );
               }
         }

         let row = -1;
         for ( let j = 0; j < this.styleMap.length; ++j )
            if ( this.styleMap[j] == FX.styleIndex )
            {
               row = j;
               break;
            }
         if ( row < 0 && this.styleMap.length > 0 )
         {
            // Never let the combo display one style while another is active.
            row = 0;
            FX.styleIndex = this.styleMap[0];
         }
         if ( row >= 0 )
            this.styleCombo.currentItem = row;
      }
      finally
      {
         this.syncing = false;
      }
   };

   this.styleIndexFor = function( comboRow )
   {
      if ( comboRow < 0 || comboRow >= this.styleMap.length )
         return -1;
      return this.styleMap[comboRow];
   };

   let styleSizer = new HorizontalSizer;
   styleSizer.spacing = 4;
   styleSizer.add( this.styleLabel );
   styleSizer.add( this.styleCombo, 100 );

   /* ==========================================================================
    * Channels section
    * ========================================================================== */

   this.makeViewRow = function( labelText, starLabelText, onSelect, onSelectStars )
   {
      let row = {};

      row.label = new Label( this );
      row.label.text = labelText;
      row.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      row.label.setFixedWidth( this.viewLabelWidth );

      row.list = new ViewList( this );
      try
      {
         row.list.excludeIdentifiersPattern = FX_TEMP_PREFIX + "*";
      }
      catch ( x )
      {
      }
      row.list.getMainViews();
      row.list.onViewSelected = onSelect;

      row.starLabel = new Label( this );
      row.starLabel.text = starLabelText;
      row.starLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      row.starLabel.setFixedWidth( this.viewLabelWidth );

      row.starList = new ViewList( this );
      try
      {
         row.starList.excludeIdentifiersPattern = FX_TEMP_PREFIX + "*";
      }
      catch ( x )
      {
      }
      row.starList.getMainViews();
      row.starList.onViewSelected = onSelectStars;

      row.sizer = new HorizontalSizer;
      row.sizer.spacing = 4;
      row.sizer.add( row.label );
      row.sizer.add( row.list, 100 );
      row.sizer.addSpacing( 6 );
      row.sizer.add( row.starLabel );
      row.sizer.add( row.starList, 100 );

      return row;
   };

   /*
    * A levels set is tuning for one particular pair of images. Carrying a black
    * point from the last set of frames onto a new one is what makes a fresh
    * render come out crushed for no visible reason, so changing a source resets
    * all three sets and says so.
    */
   this.sourceChanged = function()
   {
      let cleared = fxResetAllLevels();
      this.syncLevelsToTarget();
      // Ask for the render first: requestPreview clears any standing notice, so
      // setting ours afterwards is what makes it outlive the render it starts.
      this.requestPreview();
      if ( cleared.length > 0 )
         this.setNotice( "Source image changed - levels reset ("
                       + cleared.join( ", " ) + ")." );
   };

   this.siiRow = this.makeViewRow( "Sii:", "Sii stars:",
      function( view ) { FX.siiView = view; dlg.sourceChanged(); },
      function( view ) { FX.siiStarsView = view; dlg.sourceChanged(); } );

   this.haRow = this.makeViewRow( "Ha:", "Ha stars:",
      function( view ) { FX.haView = view; dlg.sourceChanged(); },
      function( view ) { FX.haStarsView = view; dlg.sourceChanged(); } );

   this.oiiiRow = this.makeViewRow( "Oiii:", "Oiii stars:",
      function( view ) { FX.oiiiView = view; dlg.sourceChanged(); },
      function( view ) { FX.oiiiStarsView = view; dlg.sourceChanged(); } );

   this.reloadButton = new PushButton( this );
   this.reloadButton.text = "Reload image list";
   this.reloadButton.toolTip = "<p>Rescan the workspace. Use this if you created or renamed "
                             + "images after opening this dialog.</p>";
   this.reloadButton.onClick = function()
   {
      dlg.reloadViewLists();
   };

   this.reloadViewLists = function()
   {
      if ( this.rendering )
         return;

      // Drop the cached downsampled channels first, so their hidden views
      // cannot show up in the rebuilt lists, and forget any statistics
      // measured from images that may no longer exist.
      this.engine.release();
      fxClearStatsCache();

      let rows = [ [ this.siiRow,  "siiView",  "siiStarsView"  ],
                   [ this.haRow,   "haView",   "haStarsView"   ],
                   [ this.oiiiRow, "oiiiView", "oiiiStarsView" ] ];

      for ( let i = 0; i < rows.length; ++i )
      {
         let entries = [ [ rows[i][0].list,     rows[i][1] ],
                         [ rows[i][0].starList, rows[i][2] ] ];
         for ( let j = 0; j < entries.length; ++j )
         {
            let list = entries[j][0];
            let key = entries[j][1];
            let previous = FX[key];
            let previousId = (previous != null && !previous.isNull) ? previous.id : null;
            try
            {
               list.getMainViews();
               if ( previousId != null && fxViewExists( previousId ) )
               {
                  FX[key] = View.viewById( previousId );
                  list.currentView = FX[key];
               }
               else
               {
                  FX[key] = null;   // never keep a wrapper for a window that is gone
               }
            }
            catch ( x )
            {
               FX[key] = null;
            }
         }
      }

      this.updateControls();
      this.requestPreview();
   };

   this.channelsControl = fxGroupControl( this );
   this.channelsControl.sizer.add( this.siiRow.sizer );
   this.channelsControl.sizer.add( this.haRow.sizer );
   this.channelsControl.sizer.add( this.oiiiRow.sizer );

   let reloadSizer = new HorizontalSizer;
   reloadSizer.addStretch();
   reloadSizer.add( this.reloadButton );
   this.channelsControl.sizer.add( reloadSizer );

   this.channelsBar = fxSection( this, "Images", this.channelsControl, false );

   /* ==========================================================================
    * Channel normalization section
    * ========================================================================== */

   this.normRefRow = fxComboRow( this, "Reference:", [ "Sii", "Ha", "Oiii" ],
      "<p>The channel every other one is brought up to. Ha is almost always the strongest, so it "
      + "is the usual reference.</p>",
      FX.normalizeRef,
      function( index )
      {
         if ( dlg.syncing ) return;
         FX.normalizeRef = index;
         dlg.requestPreview();
      } );

   this.normSiiRow = fxNumericRow( this, "normSii", "Sii level:",
      "<p>Where Sii's median lands, as a multiple of the reference channel's.</p>"
      + "<p>1.00 matches it exactly. Below 1 leaves Sii darker than Ha, above 1 pushes it "
      + "brighter.</p>",
      function( value ) { FX.normSii = value; dlg.requestPreview(); } );

   this.normHaRow = fxNumericRow( this, "normHa", "Ha level:",
      "<p>Where Ha's median lands, as a multiple of the reference channel's. With Ha as the "
      + "reference, 1.00 leaves it exactly as it was.</p>",
      function( value ) { FX.normHa = value; dlg.requestPreview(); } );

   this.normOiiiRow = fxNumericRow( this, "normOiii", "Oiii level:",
      "<p>Where Oiii's median lands, as a multiple of the reference channel's.</p>"
      + "<p>Oiii is usually the weakest channel, and this is the slider that decides how much "
      + "teal the palette ends up with.</p>",
      function( value ) { FX.normOiii = value; dlg.requestPreview(); } );

   this.normShadowRow = fxNumericRow( this, "normShadow", "Shadow point:",
      "<p>Where the black point sits, interpolated from each channel's darkest pixel towards its "
      + "median.</p>"
      + "<p>0 puts it exactly on the minimum and discards nothing. Raising it deepens the "
      + "background before the levels are matched.</p>",
      function( value ) { FX.normShadow = value; dlg.requestPreview(); } );

   this.normalizeControl = fxGroupControl( this );
   this.normalizeControl.sizer.add( this.normRefRow );
   this.normalizeControl.sizer.add( this.normSiiRow );
   this.normalizeControl.sizer.add( this.normHaRow );
   this.normalizeControl.sizer.add( this.normOiiiRow );
   this.normalizeControl.sizer.add( this.normShadowRow );

   this.normalizeBar = new SectionBar( this, "Channel normalization" );
   this.normalizeBar.setSection( this.normalizeControl );
   this.normalizeBar.enableCheckBox();
   this.normalizeBar.checkBox.checked = FX.normalizeEnabled;
   this.normalizeBar.checkBox.toolTip =
      "<p>Brings the channels to a common brightness before they are combined, following the "
      + "published narrowband channel normalization method.</p>"
      + "<p>Each channel gets a black point interpolated between its minimum and its median, then "
      + "a midtones curve that moves its median onto the reference channel's - a curve stretch, "
      + "not a linear scale, so faint structure is lifted without the bright cores running away.</p>"
      + "<p>This is the real fix for an SHO that comes out overwhelmingly green: Ha is typically "
      + "several times stronger than Sii and Oiii, and no amount of per-pixel colour correction "
      + "afterwards can undo that. Fix the balance first and the palette behaves.</p>";
   this.normalizeBar.onCheckSection = function( bar )
   {
      FX.normalizeEnabled = bar.checkBox.checked;
      dlg.updateControls();
      dlg.requestPreview();
   };
   if ( !FX.normalizeEnabled )
      this.normalizeControl.hide();

   /* ==========================================================================
    * Palette section
    * ========================================================================== */

   this.gainSiiRow = fxNumericRow( this, "gainSii", "Sii weight:",
      "<p>Weight applied to Sii before the combination.</p>"
      + "<p>This is a soft gain, g&middot;x / (1 + (g-1)&middot;x). It keeps 0 at 0 and 1 at 1, so "
      + "raising a channel brightens the faint signal without ever clipping the bright cores the "
      + "way a plain multiplication would.</p>",
      function( value ) { FX.gainSii = value; dlg.requestPreview(); } );

   this.gainHaRow = fxNumericRow( this, "gainHa", "Ha weight:",
      "<p>Weight applied to Ha before the combination. Soft gain, no highlight clipping.</p>"
      + "<p>Ha drives the ho mask as well as the red and green channels, so raising it moves the "
      + "gold / teal boundary outwards.</p>",
      function( value ) { FX.gainHa = value; dlg.requestPreview(); } );

   this.gainOiiiRow = fxNumericRow( this, "gainOiii", "Oiii weight:",
      "<p>Weight applied to Oiii before the combination. Soft gain, no highlight clipping.</p>"
      + "<p>Oiii feeds both dynamic masks as well as the blue channel, so this slider has the "
      + "strongest effect on where the palette switches between gold and teal.</p>",
      function( value ) { FX.gainOiii = value; dlg.requestPreview(); } );

   this.blendRow = fxNumericRow( this, "blend", "Foraxx amount:",
      "<p>Interpolates between the plain fixed mapping and the full dynamic blend.</p>"
      + "<p>0.00 gives the ordinary mapping, 1.00 the classic Foraxx result.</p>"
      + "<p><b>Foraxx palettes only.</b> A fixed mapping such as SHO or HOO is a straight "
      + "permutation of the channels, so there is nothing for this to interpolate; it and the two "
      + "transition sliders grey out.</p>",
      function( value ) { FX.blend = value; dlg.requestPreview(); } );

   this.hardORow = fxNumericRow( this, "hardO", "Sii/Ha transition:",
      "<p>Hardness of the 'o' mask, o = Oiii^(k&middot;~Oiii), which decides where red comes from "
      + "Sii and where it comes from Ha.</p>"
      + "<p>1.00 is the original. Higher values delay and sharpen the switch; lower values bring "
      + "it in earlier and soften it.</p>"
      + "<p><b>Three-channel Foraxx only</b> - it needs Sii to transition from, and a fixed "
      + "mapping has no transition.</p>",
      function( value ) { FX.hardO = value; dlg.requestPreview(); } );

   this.hardHORow = fxNumericRow( this, "hardHO", "Ha/Oiii transition:",
      "<p>Hardness of the 'ho' mask, ho = (Ha&middot;Oiii)^(k&middot;~(Ha&middot;Oiii)), which "
      + "drives the green channel and therefore the gold-to-teal boundary.</p>"
      + "<p>Usually the most consequential slider here.</p>"
      + "<p><b>Foraxx palettes only</b> - a fixed mapping has no transition to shape.</p>",
      function( value ) { FX.hardHO = value; dlg.requestPreview(); } );

   this.curveRow = fxNumericRow( this, "curveStrength", "Signature curves:",
      "<p>Scales the two hue curves of the original script towards or away from the identity "
      + "transform.</p>"
      + "<p>These act on hue, not brightness: they rotate the reds towards gold and the blues "
      + "towards teal, and are a large part of what makes a Foraxx image look the way it does.</p>",
      function( value ) { FX.curveStrength = value; dlg.requestPreview(); } );

   this.satRow = fxNumericRow( this, "satStrength", "Selective saturation:",
      "<p>Scales the global saturation curve and both selective saturation passes, which boost a "
      + "narrow band of golds and a narrow band of blues while leaving everything between them "
      + "alone.</p>",
      function( value ) { FX.satStrength = value; dlg.requestPreview(); } );

   this.extraSatRow = fxNumericRow( this, "extraSaturation", "Overall saturation:",
      "<p>A flat saturation boost across every hue, on top of the selective pass above.</p>"
      + "<p>0 leaves it alone. This is what gives the Andy Warhol palette its poster colour.</p>",
      function( value ) { FX.extraSaturation = value; dlg.requestPreview(); } );

   this.posterRow = fxNumericRow( this, "posterLevels", "Posterise levels:",
      "<p>Quantises each channel to this many evenly spaced levels, so gradients become flat "
      + "blocks of colour - the screen-print look.</p>"
      + "<p>0 is off. 4 to 8 gives a recognisable poster; higher values are subtler.</p>",
      function( value ) { FX.posterLevels = Math.round( value ); dlg.requestPreview(); } );

   this.paletteControl = fxGroupControl( this );
   this.paletteControl.sizer.add( this.gainSiiRow );
   this.paletteControl.sizer.add( this.gainHaRow );
   this.paletteControl.sizer.add( this.gainOiiiRow );
   this.paletteControl.sizer.addSpacing( 4 );
   this.paletteControl.sizer.add( this.blendRow );
   this.paletteControl.sizer.add( this.hardORow );
   this.paletteControl.sizer.add( this.hardHORow );
   this.paletteControl.sizer.addSpacing( 4 );
   this.paletteControl.sizer.add( this.curveRow );
   this.paletteControl.sizer.add( this.satRow );
   this.paletteControl.sizer.add( this.extraSatRow );
   this.paletteControl.sizer.add( this.posterRow );

   this.paletteBar = fxSection( this, "Weighting, transition and colour", this.paletteControl, false );

   /* ==========================================================================
    * Stars section
    * ========================================================================== */

   this.starsNote = new Label( this );
   this.starsNote.useRichText = true;
   this.starsNote.wordWrapping = true;
   this.starsNote.text =
      "<p>The star field is a fixed broadband-style combination:<br/>"
      + "&nbsp;&nbsp;R = 0.5&middot;Ha + 0.5&middot;Sii&nbsp;&nbsp;&nbsp;"
      + "G = 0.3&middot;Ha + 0.7&middot;Oiii&nbsp;&nbsp;&nbsp;B = Oiii</p>"
      + "<p>Stars are broadband sources, not line emitters, so mixing them this way gives more "
      + "believable colour than running the nebula's palette over them.</p>";

   this.starCleanGreenCheck = fxCheckBox( this, "Remove green from the stars",
      "<p>A two-pass green removal: remove green, push hard into the highlights with a midtones "
      + "transfer, remove green again on the stretched data, then undo the push. Working on the "
      + "stretched version is what lets the second pass reach the faint fringing the first one "
      + "misses.</p>"
      + "<p>The <b>Green / magenta suppression</b> section below does not touch the stars at all: "
      + "that correction is tuned for green coming from the channel imbalance, and over a star "
      + "field it flattens real broadband star colour into grey.</p>",
      FX.starCleanGreen,
      function( checked ) { FX.starCleanGreen = checked; dlg.requestPreview(); } );

   this.starStretchRow = fxNumericRow( this, "starStretch", "Star brightness:",
      "<p>A hyperbolic stretch, ((3^k)&middot;$T) / ((3^k-1)&middot;$T+1) - the midtones transfer "
      + "function with m = 1/(1+3^k). It fixes 0 and 1 and is monotonic, so it lifts faint stars "
      + "hard without ever clipping a bright core. 0 leaves them exactly as the combination "
      + "produced them.</p>"
      + "<p>1.00 is a gentle lift that suits stars which have already been stretched, which is "
      + "what this script expects.</p>"
      + "<p>At 5.00 the multiplier is 243, which on conditioned data lifts the empty background "
      + "to 0.81 - a white sky. Raise it only if your stars really are still faint, and watch the "
      + "preview.</p>",
      function( value ) { FX.starStretch = value; dlg.requestPreview(); } );

   this.starSatRow = fxNumericRow( this, "starSaturation", "Star colour boost:",
      "<p>A hue-weighted saturation boost, applied after the brightness stretch. This is what "
      + "brings out the blue / white / amber spread of a star field.</p>"
      + "<p>0 leaves the colour alone. 1.00 is a good starting point once the brightness is "
      + "where you want it.</p>",
      function( value ) { FX.starSaturation = value; dlg.requestPreview(); } );

   this.starsControl = fxGroupControl( this );
   this.starsControl.sizer.add( this.starsNote );
   this.starsControl.sizer.addSpacing( 4 );
   this.starsControl.sizer.add( this.starCleanGreenCheck );
   this.starsControl.sizer.add( this.starStretchRow );
   this.starsControl.sizer.add( this.starSatRow );

   this.starsBar = fxSection( this, "Stars", this.starsControl, false );

   /* ==========================================================================
    * Green / magenta suppression section
    * ========================================================================== */

   this.scnrNote = new Label( this );
   this.scnrNote.useRichText = true;
   this.scnrNote.wordWrapping = true;
   this.scnrNote.text =
      "<p>The stock <b>SCNR</b> process, average neutral, applied to the nebula only. Green is "
      + "removed directly; magenta is green in the inverse.</p>";

   this.greenRow = fxNumericRow( this, "scnrGreen", "Green amount:",
      "<p>The amount for the green pass. 0 is off, 1 removes all of the detected excess.</p>",
      function( value ) { FX.scnrGreen = value; dlg.requestPreview(); } );

   this.magentaRow = fxNumericRow( this, "scnrMagenta", "Magenta amount:",
      "<p>The amount for the magenta pass, run as invert, remove green, invert.</p>",
      function( value ) { FX.scnrMagenta = value; dlg.requestPreview(); } );

   this.preserveLightnessCheck = fxCheckBox( this, "Preserve lightness",
      "<p>Keeps the pixel's brightness where it was after the cast is removed, which is what "
      + "stops the result going flat and dim.</p>",
      FX.scnrPreserveL,
      function( checked ) { FX.scnrPreserveL = checked; dlg.requestPreview(); } );

   this.scnrControl = fxGroupControl( this );
   this.scnrControl.sizer.add( this.scnrNote );
   this.scnrControl.sizer.addSpacing( 4 );
   this.scnrControl.sizer.add( this.greenRow );
   this.scnrControl.sizer.add( this.magentaRow );
   this.scnrControl.sizer.addSpacing( 2 );
   this.scnrControl.sizer.add( this.preserveLightnessCheck );

   this.scnrBar = new SectionBar( this, "Green / magenta suppression" );
   this.scnrBar.setSection( this.scnrControl );
   this.scnrBar.enableCheckBox();
   this.scnrBar.checkBox.checked = FX.scnrEnabled;
   this.scnrBar.checkBox.toolTip = "<p>Enable or skip the whole colour suppression stage.</p>"
                                 + "<p>It applies to the <b>nebula only</b>. The stars have their "
                                 + "own green removal in the Stars section, because this correction "
                                 + "is tuned for green that comes from the channel imbalance and "
                                 + "would flatten real broadband star colour into grey.</p>";
   this.scnrBar.onCheckSection = function( bar )
   {
      FX.scnrEnabled = bar.checkBox.checked;
      dlg.updateControls();
      dlg.requestPreview();
   };
   if ( !FX.scnrEnabled )
      this.scnrControl.hide();

   /* ==========================================================================
    * HDR and local contrast section
    * ========================================================================== */

   this.hdrAmountRow = fxNumericRow( this, "hdrAmount", "Highlight compression:",
      "<p>Pulls the tones above the knee back towards it. Nothing below the knee is touched at "
      + "all.</p>"
      + "<p>The correction is computed on luminance and applied as a single scale factor to all "
      + "three channels, so hue and saturation survive intact. Entirely scale invariant, so the "
      + "preview matches the final image exactly.</p>",
      function( value ) { FX.hdrAmount = value; dlg.requestPreview(); } );

   this.hdrKneeRow = fxNumericRow( this, "hdrKnee", "Compression knee:",
      "<p>The brightness above which compression starts. Everything darker is left completely "
      + "alone.</p>"
      + "<p>Lower it to reach further down into the midtones, raise it to affect only the very "
      + "brightest cores.</p>",
      function( value ) { FX.hdrKnee = value; dlg.requestPreview(); } );

   this.hdrLayersRow = fxNumericRow( this, "hdrLayers", "HDR multiscale layers:",
      "<p>Runs a multiscale HDR transform with this many layers. 0 skips it.</p>"
      + "<p>Far more effective than a curve on genuinely blown cores, but it works on spatial "
      + "scales, so at a reduced preview sampling it can only be indicative. Check the result at "
      + "1:1, or after Execute.</p>",
      function( value ) { FX.hdrLayers = Math.round( value ); dlg.requestPreview(); } );

   this.localContrastRow = fxNumericRow( this, "localContrast", "Local contrast:",
      "<p>A large scale unsharp mask on the luminance, to put back structure that highlight "
      + "compression flattens. Also scale dependent, so the preview is indicative.</p>",
      function( value ) { FX.localContrast = value; dlg.requestPreview(); } );

   this.hdrControl = fxGroupControl( this );
   this.hdrControl.sizer.add( this.hdrAmountRow );
   this.hdrControl.sizer.add( this.hdrKneeRow );
   this.hdrControl.sizer.add( this.hdrLayersRow );
   this.hdrControl.sizer.add( this.localContrastRow );

   this.hdrBar = new SectionBar( this, "HDR and local contrast" );
   this.hdrBar.setSection( this.hdrControl );
   this.hdrBar.enableCheckBox();
   this.hdrBar.checkBox.checked = FX.hdrEnabled;
   this.hdrBar.checkBox.toolTip = "<p>Enable or skip highlight compression, "
                                + "HDRMultiscaleTransform and local contrast as a group. Off by "
                                + "default, with every amount at zero.</p>";
   this.hdrBar.onCheckSection = function( bar )
   {
      FX.hdrEnabled = bar.checkBox.checked;
      dlg.updateControls();
      dlg.requestPreview();
   };
   if ( !FX.hdrEnabled )
      this.hdrControl.hide();

   /* ==========================================================================
    * Artificial luminance section
    * ========================================================================== */

   this.lumNote = new Label( this );
   this.lumNote.useRichText = true;
   this.lumNote.wordWrapping = true;
   this.lumNote.text =
      "<p>The CIE L*a*b* lightness of the colour result, extracted as its own greyscale layer "
      + "named <i>name</i>_L. Because it is a standard lightness it behaves in an LRGB "
      + "combination, in a mask or in a curve exactly as any other luminance does.</p>"
      + "<p>To stretch it, set the preview <b>Target</b> to <b>Luminance</b> and use the histogram "
      + "below the preview - it belongs to whichever image is on screen, and the layer keeps its "
      + "own three markers.</p>";

   this.lumApplyRow = fxNumericRow( this, "lumApply", "Apply to the image:",
      "<p>How much of the artificial luminance to substitute into the colour image.</p>"
      + "<p>0 produces the layer and leaves the colour image untouched, so you can combine them "
      + "yourself. 1 fully replaces the image's own lightness. The colour ratios are preserved "
      + "either way, and the substitution stops where a channel would clip.</p>",
      function( value ) { FX.lumApply = value; dlg.requestPreview(); } );

   this.lumControl = fxGroupControl( this );
   this.lumControl.sizer.add( this.lumNote );
   this.lumControl.sizer.addSpacing( 4 );
   this.lumControl.sizer.add( this.lumApplyRow );

   this.lumBar = new SectionBar( this, "Artificial luminance" );
   this.lumBar.setSection( this.lumControl );
   this.lumBar.enableCheckBox();
   this.lumBar.checkBox.checked = FX.makeLuminance;
   this.lumBar.checkBox.toolTip = "<p>Produce a synthetic luminance layer from the narrowband "
                                + "channels, named <i>name</i>_L.</p>";
   this.lumBar.onCheckSection = function( bar )
   {
      FX.makeLuminance = bar.checkBox.checked;
      dlg.updateControls();
      dlg.requestPreview();
   };
   if ( !FX.makeLuminance )
      this.lumControl.hide();

   /* ==========================================================================
    * Output section
    * ========================================================================== */

   this.baseIdLabel = new Label( this );
   this.baseIdLabel.text = "Image name:";
   this.baseIdLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.baseIdLabel.setFixedWidth( this.labelWidth );

   this.baseIdEdit = new Edit( this );
   this.baseIdEdit.text = FX.baseId;
   let baseIdTip = "<p>Base identifier of the images produced. The stars image gets a _stars "
                 + "suffix, the screen combination _combined, the luminance _L.</p>"
                 + "<p>It follows the palette you choose, so a Warhol run lands in Warhol and an "
                 + "HSO run in HSO. Type your own if you prefer; it will be replaced the next time "
                 + "you change palette.</p>"
                 + "<p>Existing identifiers are never overwritten: a numeric suffix is added to "
                 + "the whole group at once, so the set always matches.</p>";
   this.baseIdEdit.toolTip = baseIdTip;
   this.baseIdLabel.toolTip = baseIdTip;
   this.baseIdEdit.onEditCompleted = function()
   {
      FX.baseId = this.text.trim();
      this.text = FX.baseId;
   };

   let baseIdSizer = new HorizontalSizer;
   baseIdSizer.spacing = 4;
   baseIdSizer.add( this.baseIdLabel );
   baseIdSizer.add( this.baseIdEdit, 100 );

   this.combinedCheck = fxCheckBox( this,
      "Also create a screen combination of the starless and stars images",
      "<p>Produces <i>name</i>_combined as ~(~starless * ~stars) - the screen blend - after the "
      + "levels have been applied to each of them. It can only be seen after Execute - the preview no longer has a combined target.</p>",
      FX.makeCombined,
      function( checked ) { FX.makeCombined = checked; } );

   this.factorsCheck = fxCheckBox( this, "Keep the 'o' and 'ho' dynamic factor images",
      "<p>The intermediate mask images. Useful for inspection or for reusing as masks.</p>",
      FX.makeFactors,
      function( checked ) { FX.makeFactors = checked; } );

   this.outputControl = fxGroupControl( this );
   this.outputControl.sizer.add( baseIdSizer );
   this.outputControl.sizer.add( this.combinedCheck );
   this.outputControl.sizer.add( this.factorsCheck );

   this.outputBar = fxSection( this, "Output", this.outputControl, false );

   /* ==========================================================================
    * Preview panel
    * ========================================================================== */

   this.preview = new FXPreviewControl( this );
   this.preview.setScaledMinSize( 360, 260 );
   this.preview.viewport.onResize = function( w, h, oldW, oldH )
   {
      dlg.preview.initScrollBars();
      // In Fit the effective zoom is a function of the panel size, so the
      // readout goes stale the moment the panel moves.
      if ( FX.previewFit )
      {
         dlg.updateZoomReadout();
         dlg.updatePreviewStatus();
      }
      // Auto detail is derived from the panel size, so a resized panel wants a
      // fresh render. The timer coalesces the resize storm.
      if ( FX.previewDetail == 0 )
         dlg.requestPreview();
   };
   /*
    * Zoom is a display transform. Stepping it repaints the image already in
    * hand; the pipeline is not run again.
    */
   this.applyZoom = function()
   {
      this.preview.setZoom( FX.previewScale, FX.previewFit );
      this.updateZoomReadout();
      this.updatePreviewStatus();
   };

   /*
    * The control owns the zoom while the wheel is turning; this copies it back
    * into the parameter store so it is what gets saved and restored.
    */
   this.preview.onZoomChanged = function()
   {
      FX.previewFit = dlg.preview.fitToPanel;
      FX.previewScale = dlg.preview.displayZoom;
      dlg.updateZoomReadout();
      dlg.updatePreviewStatus();
   };

   this.updateZoomReadout = function()
   {
      let z = Math.round( this.preview.effectiveZoom() * 100 );
      this.zoomReadout.text = FX.previewFit ? format( "Fit %d%%", z )
                                            : format( "%d%%", z );
      this.zoomFitButton.enabled = !FX.previewFit;
   };

   this.previewTargetCombo = new ComboBox( this );
   this.previewTargetCombo.addItem( "Starless" );
   this.previewTargetCombo.addItem( "Stars" );
   this.previewTargetCombo.addItem( "Luminance" );
   this.previewTargetCombo.toolTip = "<p>Which image to show, and which image the histogram below "
                                   + "belongs to. Each of the three carries its own black point, "
                                   + "midtones and white point; switching here brings that image's "
                                   + "markers back, and each set is applied only to its own image "
                                   + "when you press Execute.</p>"
                                   + "<p><b>Luminance</b> is the extracted L layer. You can look "
                                   + "at it without switching the Artificial luminance section "
                                   + "on - it is only written out when that section is on.</p>"
;
   this.previewTargetCombo.onItemSelected = function( index )
   {
      if ( dlg.syncing ) return;
      dlg.setPreviewTarget( index );
      dlg.refreshPreview();
   };

   /*
    * Zoom controls. The wheel over the panel is the main gesture; these are for
    * getting to Fit and 1:1 without hunting, and for anyone on a trackpad.
    */
   let zoomTip = "<p>How large the rendered preview is drawn. This is a display scale only - it "
               + "repaints the image already in hand and never runs the pipeline again.</p>"
               + "<p><b>Roll the mouse wheel over the panel</b> to zoom continuously about the "
               + "cursor: the pixel under the pointer stays under the pointer. Drag to pan, and "
               + "double click anywhere in the panel to go back to Fit.</p>"
               + "<p>How much detail there is to zoom into is set by <b>Detail</b>, next to "
               + "this.</p>";

   this.zoomFitButton = new PushButton( this );
   this.zoomFitButton.text = "Fit";
   this.zoomFitButton.toolTip = zoomTip;
   this.zoomFitButton.setScaledMinWidth( 34 );
   this.zoomFitButton.onClick = function()
   {
      FX.previewFit = true;
      dlg.applyZoom();
   };

   this.zoomOneButton = new PushButton( this );
   this.zoomOneButton.text = "1:1";
   this.zoomOneButton.toolTip = zoomTip;
   this.zoomOneButton.setScaledMinWidth( 34 );
   this.zoomOneButton.onClick = function()
   {
      // Routed through the anchored path, so 1:1 lands on the middle of what
      // was on screen rather than on the top-left corner of the frame.
      let z = dlg.preview.effectiveZoom();
      if ( z > 0 && dlg.preview.zoomAboutCentre( 1/z ) )
         dlg.preview.notifyZoom();
   };

   this.zoomOutButton = new PushButton( this );
   this.zoomOutButton.text = "-";
   this.zoomOutButton.toolTip = zoomTip;
   this.zoomOutButton.setScaledMinWidth( 26 );
   this.zoomOutButton.onClick = function()
   {
      if ( dlg.preview.zoomAboutCentre( dlg.preview.zoomOutStep ) )
         dlg.preview.notifyZoom();
   };

   this.zoomInButton = new PushButton( this );
   this.zoomInButton.text = "+";
   this.zoomInButton.toolTip = zoomTip;
   this.zoomInButton.setScaledMinWidth( 26 );
   this.zoomInButton.onClick = function()
   {
      if ( dlg.preview.zoomAboutCentre( dlg.preview.zoomInStep ) )
         dlg.preview.notifyZoom();
   };

   this.zoomReadout = new Label( this );
   this.zoomReadout.text = "Fit";
   this.zoomReadout.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.zoomReadout.toolTip = zoomTip;
   this.zoomReadout.setScaledMinWidth( 54 );

   this.previewDetailCombo = new ComboBox( this );
   this.previewDetailCombo.addItem( "Detail: auto" );
   this.previewDetailCombo.addItem( "Detail: 1:1" );
   this.previewDetailCombo.addItem( "Detail: 1:2" );
   this.previewDetailCombo.addItem( "Detail: 1:4" );
   this.previewDetailCombo.addItem( "Detail: 1:8" );
   this.previewDetailCombo.toolTip = "<p>The sampling the pipeline actually runs at. Changing this "
                                   + "<i>does</i> re-render.</p>"
                                   + "<p><b>Auto</b> renders at twice the panel resolution, so "
                                   + "zooming to 200% is still pixel exact. Choose 1:1 when you "
                                   + "want to inspect the real result - it is slow on a large "
                                   + "frame and uses a lot of memory.</p>";
   this.previewDetailCombo.onItemSelected = function( index )
   {
      if ( dlg.syncing ) return;
      FX.previewDetail = index;
      dlg.refreshPreview();
   };

   this.autoPreviewCheck = fxCheckBox( this, "Auto",
      "<p>Re-render the preview automatically a moment after a control settles. Turn it off on "
      + "very large images and use Refresh instead.</p>",
      FX.autoPreview,
      function( checked )
      {
         FX.autoPreview = checked;
         if ( checked )
            dlg.requestPreview();
      } );

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh";
   fxSetIcon( this, this.refreshButton, ":/icons/reload.png", null );
   this.refreshButton.toolTip = "<p>Re-render the preview now, re-reading and re-measuring the "
                              + "source images.</p>"
                              + "<p>Use this after editing a channel in PixInsight: the preview "
                              + "works from its own downsampled copies, and nothing else drops "
                              + "them while the image keeps its identifier.</p>";
   this.refreshButton.onClick = function()
   {
      // Release the downsampled copies, not just the statistics. They are keyed
      // on image identifiers, never on content, so editing a channel in place -
      // stretching it, say - left Refresh re-rendering the pre-edit pixels while
      // its own tooltip promised it was re-measuring the sources.
      fxClearStatsCache();
      dlg.engine.release();
      dlg.refreshPreview();
   };

   this.previewStatus = new Label( this );
   this.previewStatus.wordWrapping = true;
   this.previewStatus.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.previewStatus.text = "Select your channels to build a preview.";
   this.previewStatus.minHeight = this.logicalPixelsToPhysical( 30 );

   let previewToolSizer = new HorizontalSizer;
   previewToolSizer.spacing = 6;
   previewToolSizer.add( this.previewTargetCombo );
   previewToolSizer.add( this.zoomFitButton );
   previewToolSizer.add( this.zoomOneButton );
   previewToolSizer.add( this.zoomOutButton );
   previewToolSizer.add( this.zoomInButton );
   previewToolSizer.add( this.zoomReadout );
   previewToolSizer.add( this.previewDetailCombo );
   previewToolSizer.add( this.autoPreviewCheck );
   previewToolSizer.addStretch();
   previewToolSizer.add( this.refreshButton );

   this.previewGroup = new GroupBox( this );
   this.previewGroup.title = "Preview";
   this.previewGroup.sizer = new VerticalSizer;
   this.previewGroup.sizer.margin = 6;
   this.previewGroup.sizer.spacing = 4;
   this.previewGroup.sizer.add( previewToolSizer );
   this.previewGroup.sizer.add( this.preview, 100 );
   this.previewGroup.sizer.add( this.previewStatus );

   /* ==========================================================================
    * Levels panel
    * ========================================================================== */

   /*
    * The histogram belongs to whatever the preview is showing. Each of the
    * three images carries its own black point, midtones and white point;
    * switching the target brings that image's markers back and redraws the
    * histogram from that image, and at Execute each set is applied only to its
    * own image. Before this, one set of markers described the starless
    * histogram and was applied to the starless image no matter what you were
    * looking at, so adjusting them while examining the stars quietly crushed
    * the nebula.
    */
   const FX_LEVEL_KEYS = [
      { title: "Levels - starless image",  low: "levelsLow",
        mid: "levelsMid",     high: "levelsHigh" },
      { title: "Levels - stars image",     low: "starLevelsLow",
        mid: "starLevelsMid", high: "starLevelsHigh" },
      { title: "Levels - luminance layer", low: "lumLow",
        mid: "lumMid",        high: "lumHigh" }
   ];

   this.levelKeys = function()
   {
      return FX_LEVEL_KEYS[ fxClamp( FX.previewTarget, 0, FX_LEVEL_KEYS.length - 1 ) ];
   };

   this.levels = new FXLevelsControl( this );
   this.levels.toolTip =
      "<p>Histogram of the image the preview is showing, as it stands immediately before its own "
      + "levels transform, drawn as one outline per channel on a logarithmic vertical scale.</p>"
      + "<p>Drag the three triangles: the dark one on the left is the black point, the grey one in "
      + "the middle is the midtones balance, the light one on the right is the white point. Double "
      + "click a triangle to reset just that one.</p>"
      + "<p><b>Each image keeps its own three markers.</b> Change the preview target and this "
      + "panel switches to that image's set; at Execute each set is applied to its own image and "
      + "to nothing else.</p>";
   this.levels.onValueChanged = function( low, mid, high, finished )
   {
      let k = dlg.levelKeys();
      FX[k.low] = low;
      FX[k.mid] = mid;
      FX[k.high] = high;
      dlg.updateLevelsReadout();
      dlg.requestPreview();
   };

   this.levelsReadout = new Label( this );
   this.levelsReadout.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.levelsReadout.toolTip = "<p>Black point, midtones balance and white point of the image the "
                              + "preview is showing.</p>";

   this.updateLevelsReadout = function()
   {
      let k = this.levelKeys();
      this.levelsReadout.text = format( "black %.4f    mid %.4f    white %.4f",
                                        FX[k.low], FX[k.mid], FX[k.high] );
   };

   /*
    * Loads the current target's markers into the control and retitles the box.
    * Called whenever the target changes, so the panel always describes and acts
    * on the image on screen.
    */
   /*
    * The only place the preview target changes. It moves the value, the combo
    * and the levels panel together, because the panel deciding which set to
    * write is derived from the target - and one path that moved the target
    * without the panel was enough to write star markers into the nebula's set.
    */
   this.setPreviewTarget = function( index )
   {
      FX.previewTarget = fxClamp( index, 0, FX_LEVEL_KEYS.length - 1 );
      let wasSyncing = this.syncing;
      this.syncing = true;
      try
      {
         this.previewTargetCombo.currentItem = FX.previewTarget;
      }
      finally
      {
         this.syncing = wasSyncing;
      }
      this.syncLevelsToTarget();
      // The bins on screen belong to the image that has just been replaced.
      this.levels.setHistogram( null );
   };

   this.syncLevelsToTarget = function()
   {
      let k = this.levelKeys();
      this.levelsGroup.title = k.title;
      this.levels.setValues( FX[k.low], FX[k.mid], FX[k.high] );
      this.updateLevelsReadout();
   };

   this.levelsAutoButton = new PushButton( this );
   this.levelsAutoButton.text = "Auto";
   this.levelsAutoButton.toolTip = "<p>Read a starting point off the current histogram: clip the "
                                 + "black point just below where real signal begins, and place "
                                 + "the median at a comfortable 0.30.</p>"
                                 + "<p>Applies to the image the preview is showing.</p>";
   this.levelsAutoButton.onClick = function()
   {
      let v = dlg.levels.autoValues();
      if ( v == null )
      {
         dlg.setNotice( "No histogram yet - render a preview first." );
         return;
      }
      let k = dlg.levelKeys();
      FX[k.low] = v.low;
      FX[k.mid] = v.mid;
      FX[k.high] = v.high;
      dlg.levels.setValues( v.low, v.mid, v.high );
      dlg.updateLevelsReadout();
      dlg.requestPreview();
   };

   this.levelsResetButton = new PushButton( this );
   this.levelsResetButton.text = "Reset";
   this.levelsResetButton.toolTip = "<p>Put this image's three markers back to black 0, mid 0.5, "
                                  + "white 1 - an identity transform. The other images keep "
                                  + "theirs.</p>";
   this.levelsResetButton.onClick = function()
   {
      let k = dlg.levelKeys();
      FX[k.low] = FXDefaults[k.low];
      FX[k.mid] = FXDefaults[k.mid];
      FX[k.high] = FXDefaults[k.high];
      dlg.levels.setValues( FX[k.low], FX[k.mid], FX[k.high] );
      dlg.updateLevelsReadout();
      dlg.requestPreview();
   };

   let levelsButtonSizer = new HorizontalSizer;
   levelsButtonSizer.spacing = 6;
   levelsButtonSizer.add( this.levelsReadout, 100 );
   levelsButtonSizer.add( this.levelsAutoButton );
   levelsButtonSizer.add( this.levelsResetButton );

   this.levelsGroup = new GroupBox( this );
   this.levelsGroup.title = "Levels - starless image";
   this.levelsGroup.sizer = new VerticalSizer;
   this.levelsGroup.sizer.margin = 6;
   this.levelsGroup.sizer.spacing = 4;
   this.levelsGroup.sizer.add( this.levels, 100 );
   this.levelsGroup.sizer.add( levelsButtonSizer );

   /* ==========================================================================
    * Splitters
    * ========================================================================== */

   this.setSideBarWidth = function( logical )
   {
      let w = Math.max( 400, Math.min( 1400, Math.round( logical ) ) );
      FX.sideBarWidth = w;
      this.leftPanel.setFixedWidth( Math.round( w * this.uiScale ) );
   };

   this.setHistogramHeight = function( logical )
   {
      let h = Math.max( 200, Math.min( 600, Math.round( logical ) ) );
      FX.histogramHeight = h;
      this.levelsGroup.setFixedHeight( Math.round( h * this.uiScale ) );
   };

   this.sideBarStart = FX.sideBarWidth;
   this.histogramStart = FX.histogramHeight;

   this.sideSplitter = new FXSplitter( this, true );
   this.sideSplitter.onDragBegin = function()
   {
      dlg.sideBarStart = FX.sideBarWidth;
   };
   this.sideSplitter.onDrag = function( delta )
   {
      dlg.setSideBarWidth( dlg.sideBarStart + delta / dlg.uiScale );
   };
   this.sideSplitter.onReset = function()
   {
      dlg.setSideBarWidth( FXDefaults.sideBarWidth );
   };

   this.histogramSplitter = new FXSplitter( this, false );
   this.histogramSplitter.onDragBegin = function()
   {
      dlg.histogramStart = FX.histogramHeight;
   };
   this.histogramSplitter.onDrag = function( delta )
   {
      // The histogram sits below the preview, so dragging down shrinks it.
      dlg.setHistogramHeight( dlg.histogramStart - delta / dlg.uiScale );
   };
   this.histogramSplitter.onReset = function()
   {
      dlg.setHistogramHeight( FXDefaults.histogramHeight );
   };

   /* ==========================================================================
    * Bottom bar
    * ========================================================================== */

   this.newInstanceButton = new ToolButton( this );
   fxSetIcon( this, this.newInstanceButton, ":/process-interface/new-instance.png", "■" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip = "<p>New Instance - drag this onto the workspace to save the "
                                  + "current settings as a process icon.</p>";
   this.newInstanceButton.onMousePress = function()
   {
      this.hasFocus = true;
      fxExportParameters();
      this.pushed = false;
      dlg.newInstance();
   };

   this.versionLabel = new Label( this );
   this.versionLabel.text = "v" + VERSION;
   this.versionLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.resetAllButton = new PushButton( this );
   this.resetAllButton.text = "Reset all";
   this.resetAllButton.toolTip = "<p>Put every slider and checkbox back to its factory default. "
                               + "Your channel selection is kept.</p>";
   this.resetAllButton.onClick = function()
   {
      // paletteSchema is bookkeeping, not a setting: it records which migrations
      // this object has already been through. Restoring its factory value
      // rewound it to 1 and re-armed every one-shot migration, and
      // fxMigratePreviewTarget is not idempotent - a Luminance preview target
      // chosen after a Reset all came back as Starless the next session.
      let schema = FX.paletteSchema;
      for ( let key in FXDefaults )
         FX[key] = FXDefaults[key];
      FX.paletteSchema = schema;
      fxSyncStyle();
      dlg.pullFromParameters();
      dlg.updateControls();
      dlg.setSideBarWidth( FX.sideBarWidth );
      dlg.setHistogramHeight( FX.histogramHeight );
      dlg.requestPreview();
   };

   this.executeButton = new PushButton( this );
   this.executeButton.text = "Execute";
   fxSetIcon( this, this.executeButton, ":/icons/power.png", null );
   this.executeButton.toolTip = "<p>Build the full resolution images with the current settings.</p>"
                              + "<p>The dialog stays open, so you can change palette and run it "
                              + "again. Each run gets its own set of image names.</p>";
   this.executeButton.onClick = function()
   {
      dlg.runFinal();
   };

   /*
    * The full resolution render, run from the dialog rather than after it, so
    * several palettes can be produced in one sitting.
    */
   this.runFinal = function()
   {
      if ( this.rendering )
         return;

      let problems = fxValidate( FX );
      if ( problems.length > 0 )
      {
         (new MessageBox( problems.join( "\n\n" ), TITLE, StdIcon_Warning, StdButton_Ok )).execute();
         return;
      }

      this.rendering = true;
      this.updateTimer.stop();
      this.executeButton.enabled = false;
      this.refreshButton.enabled = false;
      // PixInsight pumps the event loop from inside a running process, so Close
      // has to go too: dismissing the dialog mid-render would fire onHide and
      // release the engine while fxRenderFinal is still on the stack.
      this.cancelButton.enabled = false;
      // For the same reason, every other control has to go with it. The render
      // reads FX incrementally - the palette, the weights, the star settings and
      // the three levels sets are each picked up at a different point - while a
      // control handler writes FX the instant it fires. One slider nudged during
      // a run therefore splices two parameter sets into a single image, and
      // fxReport then prints the final state as though it had been used
      // throughout, which is exactly the reproducibility that report exists to
      // provide. Locking the panels is what makes the console log true.
      this.leftPanel.enabled = false;
      this.previewGroup.enabled = false;
      this.levelsGroup.enabled = false;
      this.cursor = new Cursor( StdCursor_Wait );

      Console.show();
      Console.writeln( "<end><cbr><br>" + TITLE + ": building the full resolution images..." );
      Console.flush();
      processEvents();

      let started = (new Date).getTime();
      let created = null;
      try
      {
         // Measure the sources as they are now, not as the preview last saw them.
         fxClearStatsCache();
         created = fxRenderFinal( FX );
      }
      catch ( error )
      {
         Console.criticalln( "*** " + TITLE + ": " + error.message );
         (new MessageBox( "The render failed:\n\n" + error.message,
                          TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
      finally
      {
         // The sweep below closes the engine's cached channels along with
         // everything else, so tell it rather than leaving it holding
         // identifiers for windows that no longer exist.
         this.engine.release();
         fxSweepTemporaries();
         this.cursor = new Cursor( StdCursor_Arrow );
         this.leftPanel.enabled = true;
         this.previewGroup.enabled = true;
         this.levelsGroup.enabled = true;
         this.executeButton.enabled = true;
         this.refreshButton.enabled = true;
         this.cancelButton.enabled = true;
      }

      if ( created == null )
      {
         this.rendering = false;
         this.previewStatus.text = "The render failed - see the console.";
         return;
      }

      this.didRun = true;
      fxReport( created, (new Date).getTime() - started );
      fxSaveSettings();

      // Only now: fxReport and reloadViewLists both pump the event loop, and
      // the preview timer must not fire into half-released state.
      this.rendering = false;

      // The new outputs are not in the view lists; a rescan keeps them
      // selectable as sources for a later run.
      this.reloadViewLists();

      // Last, because reloadViewLists ends in requestPreview, which clears any
      // standing notice. The list of what was just created is the one thing the
      // user needs off this screen, and it used to be wiped by the very refresh
      // this function set in motion.
      this.setNotice( "Created " + created.starless
                    + (created.stars ? (", " + created.stars) : "")
                    + (created.combined ? (", " + created.combined) : "")
                    + (created.luminance ? (", " + created.luminance) : "")
                    + ".  Change palette and run again, or Close." );
   };

   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Close";
   fxSetIcon( this, this.cancelButton, ":/icons/close.png", null );
   this.cancelButton.toolTip = "<p>Close the dialog. Anything you already built with Execute "
                             + "stays where it is.</p>";
   this.cancelButton.onClick = function()
   {
      dlg.cancel();
   };

   let bottomSizer = new HorizontalSizer;
   bottomSizer.spacing = 6;
   bottomSizer.add( this.newInstanceButton );
   bottomSizer.addSpacing( 8 );
   bottomSizer.add( this.versionLabel );
   bottomSizer.addStretch();
   bottomSizer.add( this.resetAllButton );
   bottomSizer.add( this.executeButton );
   bottomSizer.add( this.cancelButton );

   /* ==========================================================================
    * Layout
    * ========================================================================== */

   this.leftSizer = new VerticalSizer;
   this.leftSizer.spacing = 4;
   this.leftSizer.add( dataSizer );
   this.leftSizer.add( this.starlessOnlyCheck );
   this.leftSizer.addSpacing( 4 );
   this.leftSizer.add( styleSizer );
   this.leftSizer.addSpacing( 6 );
   this.leftSizer.add( this.channelsBar );
   this.leftSizer.add( this.channelsControl );
   this.leftSizer.add( this.normalizeBar );
   this.leftSizer.add( this.normalizeControl );
   this.leftSizer.add( this.paletteBar );
   this.leftSizer.add( this.paletteControl );
   this.leftSizer.add( this.starsBar );
   this.leftSizer.add( this.starsControl );
   this.leftSizer.add( this.scnrBar );
   this.leftSizer.add( this.scnrControl );
   this.leftSizer.add( this.hdrBar );
   this.leftSizer.add( this.hdrControl );
   this.leftSizer.add( this.lumBar );
   this.leftSizer.add( this.lumControl );
   this.leftSizer.add( this.outputBar );
   this.leftSizer.add( this.outputControl );
   this.leftSizer.addStretch();

   this.leftPanel = new Control( this );
   this.leftPanel.sizer = this.leftSizer;

   this.rightSizer = new VerticalSizer;
   this.rightSizer.spacing = 0;
   this.rightSizer.add( this.previewGroup, 100 );
   this.rightSizer.addSpacing( 2 );
   this.rightSizer.add( this.histogramSplitter );
   this.rightSizer.addSpacing( 2 );
   this.rightSizer.add( this.levelsGroup );

   this.rightPanel = new Control( this );
   this.rightPanel.sizer = this.rightSizer;

   this.columnsSizer = new HorizontalSizer;
   this.columnsSizer.spacing = 0;
   this.columnsSizer.add( this.leftPanel );
   this.columnsSizer.addSpacing( 2 );
   this.columnsSizer.add( this.sideSplitter );
   this.columnsSizer.addSpacing( 2 );
   this.columnsSizer.add( this.rightPanel, 100 );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add( this.header );
   this.sizer.add( this.columnsSizer, 100 );
   this.sizer.add( bottomSizer );

   /* ==========================================================================
    * State synchronisation
    * ========================================================================== */

   this.syncing = false;

   /*
    * Pushes the parameter store back into the controls. Used after a style, a
    * reset or a channel-count change, and once at start-up.
    */
   this.pullFromParameters = function()
   {
      this.syncing = true;
      try
      {
         this.normSiiRow.setValue( FX.normSii );
         this.normHaRow.setValue( FX.normHa );
         this.normOiiiRow.setValue( FX.normOiii );
         this.normShadowRow.setValue( FX.normShadow );
         this.gainSiiRow.setValue( FX.gainSii );
         this.gainHaRow.setValue( FX.gainHa );
         this.gainOiiiRow.setValue( FX.gainOiii );
         this.blendRow.setValue( FX.blend );
         this.hardORow.setValue( FX.hardO );
         this.hardHORow.setValue( FX.hardHO );
         this.curveRow.setValue( FX.curveStrength );
         this.satRow.setValue( FX.satStrength );
         this.extraSatRow.setValue( FX.extraSaturation );
         this.posterRow.setValue( FX.posterLevels );
         this.greenRow.setValue( FX.scnrGreen );
         this.magentaRow.setValue( FX.scnrMagenta );
         this.hdrAmountRow.setValue( FX.hdrAmount );
         this.hdrKneeRow.setValue( FX.hdrKnee );
         this.hdrLayersRow.setValue( FX.hdrLayers );
         this.localContrastRow.setValue( FX.localContrast );
         this.lumApplyRow.setValue( FX.lumApply );

         this.normRefRow.combo.currentItem = FX.normalizeRef;

         this.starCleanGreenCheck.checked = FX.starCleanGreen;
         this.starStretchRow.setValue( FX.starStretch );
         this.starSatRow.setValue( FX.starSaturation );

         this.preserveLightnessCheck.checked = FX.scnrPreserveL;
         // A switched section has to follow its own switch. Reset all and a
         // process icon both change these behind the dialog's back, and a
         // ticked-but-collapsed - or unticked-but-open - section reads as a bug.
         let syncSection = function( bar, control, on )
         {
            bar.checkBox.checked = on;
            if ( on )
               control.show();
            else
               control.hide();
         };
         syncSection( this.scnrBar,      this.scnrControl,      FX.scnrEnabled );
         syncSection( this.hdrBar,       this.hdrControl,       FX.hdrEnabled );
         syncSection( this.normalizeBar, this.normalizeControl, FX.normalizeEnabled );
         syncSection( this.lumBar,       this.lumControl,       FX.makeLuminance );

         this.baseIdEdit.text = FX.baseId;
         this.combinedCheck.checked = FX.makeCombined;
         this.factorsCheck.checked = FX.makeFactors;
         this.autoPreviewCheck.checked = FX.autoPreview;
         this.preview.setZoom( FX.previewScale, FX.previewFit );
         this.updateZoomReadout();
         this.updatePreviewStatus();
         this.previewDetailCombo.currentItem = FX.previewDetail;
         this.previewTargetCombo.currentItem = FX.previewTarget;
         this.starlessOnlyCheck.checked = !FX.makeStars;
         this.threeChannelRadio.checked = !FX.twoChannels;
         this.twoChannelRadio.checked = FX.twoChannels;

         this.syncLevelsToTarget();
      }
      finally
      {
         this.syncing = false;
      }

      this.rebuildStyleCombo();
   };

   /*
    * Enables and disables whatever the current selection makes irrelevant.
    */
   this.updateControls = function()
   {
      let style = fxStyle( FX );
      let needsSii = style.needsSii;
      let stars = FX.makeStars;

      this.siiRow.label.enabled = needsSii;
      this.siiRow.list.enabled = needsSii;
      this.siiRow.starLabel.enabled = needsSii && stars;
      this.siiRow.starList.enabled = needsSii && stars;

      this.haRow.starLabel.enabled = stars;
      this.haRow.starList.enabled = stars;
      this.oiiiRow.starLabel.enabled = stars;
      this.oiiiRow.starList.enabled = stars;

      this.gainSiiRow.enabled = needsSii;
      // The transitions belong to the Foraxx palettes. A fixed mapping is a
      // permutation of the channels and has no transition to shape, so all
      // three grey out - and fxSanitize holds the Foraxx amount at 0 there, so
      // a greyed slider can never be hiding a live value.
      this.blendRow.enabled = style.dynamic;
      this.hardORow.enabled = style.dynamic && needsSii;
      this.hardHORow.enabled = style.dynamic;

      // The section bar carries the title and the collapse arrow, so it has to
      // grey out with its contents or the section still reads as available.
      this.starsBar.enabled = stars;
      this.starsControl.enabled = stars;
      this.combinedCheck.enabled = stars;

      this.normalizeControl.enabled = FX.normalizeEnabled;
      this.normSiiRow.enabled = FX.normalizeEnabled && needsSii;
      if ( !needsSii && FX.normalizeRef == 0 )
      {
         // Sii is not in this palette, so it cannot be the reference.
         FX.normalizeRef = 1;
         let wasSyncing = this.syncing;
         this.syncing = true;
         try
         {
            this.normRefRow.combo.currentItem = 1;
         }
         finally
         {
            this.syncing = wasSyncing;
         }
      }
      this.scnrControl.enabled = FX.scnrEnabled;
      this.hdrControl.enabled = FX.hdrEnabled;
      this.lumControl.enabled = FX.makeLuminance;

      // Only the star targets need the star images. Starless and Luminance do
      // not, and forcing those back to 0 made Luminance unreachable for anyone
      // working starless-only.
      if ( !stars && FX.previewTarget == 1 )
      {
         // Through the funnel, so the levels panel follows. Setting the target
         // here and suppressing the combo's handler is what used to leave the
         // panel showing the star markers while writes went to the starless set.
         this.setPreviewTarget( 0 );
      }
      // Left enabled even without star images: Starless and Luminance are both
      // still valid, and the engine already refuses the two star targets with a
      // message that says what to do about it.
      this.previewTargetCombo.enabled = true;
   };

   /* ==========================================================================
    * Lifetime
    * ========================================================================== */

   this.onShow = function()
   {
      this.initialised = true;
      this.updateControls();
      this.applyZoom();
      this.requestPreview();
   };

   this.onHide = function()
   {
      this.updateTimer.stop();
      this.preview.setImage( null );
      this.engine.release();
      fxSweepTemporaries();
   };

   this.pullFromParameters();
   this.updateControls();
   this.setSideBarWidth( FX.sideBarWidth );
   this.setHistogramHeight( FX.histogramHeight );

   this.adjustToContents();
   this.setScaledMinSize( 980, 640 );
}

ForaxxStudioDialog.prototype = new Dialog;

#endif   // __FX_Dialog_js
