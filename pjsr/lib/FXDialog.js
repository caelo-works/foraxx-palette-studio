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

#include "FXStrings.js"
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
// The emblem file, looked for beside the script and in the installed icon
// directory. Named once so the two places that build a path agree.
#define FX_ICON_NAME "ForaxxPaletteStudio.svg"

/*
 * Open a URL with the platform's default handler. The "by CaeloWorks" line in
 * the header is a link, and PJSR has no browser of its own.
 */
function fxOpenInBrowser( url )
{
   try
   {
      let plat = String( CoreApplication.platform );
      let P = new ExternalProcess;
      if ( /win|mswindows/i.test( plat ) )
         P.start( "cmd", [ "/c", "start", "", url ] );
      else if ( /mac|osx/i.test( plat ) )
         P.start( "/usr/bin/open", [ url ] );
      else
         P.start( "xdg-open", [ url ] );
      if ( P.waitForStarted )
         P.waitForStarted();
   }
   catch ( x )
   {
      // A header that cannot open a browser is not a reason to stop working.
      Console.warningln( "Could not open " + url );
   }
}

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
function fxNumericRow( dialog, name, onUpdate )
{
   // The label and the tooltip are read from the string table under this row's
   // own name - "gainSii" and "gainSiiTip" - so a row translates itself and
   // nothing has to remember it exists when the language changes.
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
   nc.label.setFixedWidth( dialog.labelWidth );
   nc.setRange( range[0], range[1] );
   nc.slider.setRange( 0, 1000 );
   nc.slider.setScaledMinWidth( 140 );
   nc.setPrecision( range[2] );
   nc.setReal( range[2] > 0 );
   nc.setValue( FX[name] );
   nc.onValueUpdated = onUpdate;

   let btn = fxResetButton( dialog, row, "", function()
   {
      let d = defaultOf();
      nc.setValue( d );
      onUpdate( d );
   } );

   row.retranslate = function()
   {
      let label = fxT( name );
      let body = fxT( name + "Tip" );
      let tip = body
              + "<p><i>" + format( fxT( "rangeNote" ),
                                   fxFmt( range[0], range[2] ), fxFmt( range[1], range[2] ) )
              + "</i></p>";
      nc.label.text = label;
      nc.label.setFixedWidth( dialog.labelWidth );
      nc.toolTip = tip;
      nc.label.toolTip = tip;
      nc.slider.toolTip = tip;
      nc.edit.toolTip = tip;
      row.toolTip = tip;
      btn.toolTip = fxT( "resetToPalette" ) + "<br/>" + body;
   };
   row.retranslate();
   dialog.fxRegisterRow( row );

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

/*
 * A checkbox that reads its own label and tooltip from the string table, under
 * `key` and key + "Tip". `dialog` may be null for a box built before the
 * registry exists; it then keeps whatever the table said at construction.
 */
function fxCheckBox( parent, key, checked, onCheck, dialog )
{
   let cb = new CheckBox( parent );
   cb.checked = checked;
   cb.onCheck = onCheck;
   cb.retranslate = function()
   {
      cb.text = fxT( key );
      cb.toolTip = fxT( key + "Tip" );
   };
   cb.retranslate();
   if ( dialog != null )
      dialog.fxRegisterRow( cb );
   return cb;
}

/*
 * A labelled combo box, with the tooltip on both halves.
 */
function fxComboRow( dialog, key, items, current, onSelect )
{
   let row = new Control( dialog );

   let label = new Label( row );
   label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   label.setFixedWidth( dialog.labelWidth );

   let combo = new ComboBox( row );
   for ( let i = 0; i < items.length; ++i )
      combo.addItem( items[i] );
   combo.currentItem = current;

   row.retranslate = function()
   {
      label.text = fxT( key );
      label.setFixedWidth( dialog.labelWidth );
      label.toolTip = fxT( key + "Tip" );
      combo.toolTip = fxT( key + "Tip" );
   };
   row.retranslate();
   dialog.fxRegisterRow( row );
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

/*
 * A section bar whose title comes from the string table.
 *
 * The title is passed at construction, which is the only assignment PixInsight
 * is certain to honour: setting SectionBar.title afterwards leaves the drawn
 * label untouched, so a language switch used to change everything inside a
 * section while its heading stayed in the language the dialog opened in.
 * fxRetitleSection below tries the ways there are to repaint it.
 */
/*
 * Collapsing a section must not resize the window.
 *
 * PixInsight's own idiom does the opposite: its handler calls adjustToContents()
 * so the dialog shrinks to fit whatever is still open. That is reasonable for a
 * dialog you fill in once and dismiss, and wrong for one you work in - every
 * fold and unfold moves the preview, the panel widths and the window edges out
 * from under the cursor.
 *
 * So the height is pinned across the toggle and handed back afterwards. The
 * column simply has more or less in it; the window stays where the user put it.
 */
function fxKeepWindowSize( dialog )
{
   return function( bar, beginToggle )
   {
      if ( beginToggle )
      {
         dialog.__lockedHeight = dialog.height;
         dialog.__lockedWidth = dialog.width;
      }
      else
      {
         try
         {
            dialog.setFixedSize( dialog.__lockedWidth, dialog.__lockedHeight );
            dialog.adjustToContents();
            dialog.setVariableSize();
            dialog.setScaledMinSize( 980, 640 );
         }
         catch ( x )
         {
         }
         dialog.updateLeftScroll();
      }
   };
}

function fxSection( dialog, key, control, collapsed )
{
   let bar = new SectionBar( dialog, fxT( key ) );
   bar.__titleKey = key;
   bar.setSection( control );
   bar.onToggleSection = fxKeepWindowSize( dialog );
   if ( collapsed )
      control.hide();
   return bar;
}

/*
 * Re-title a section bar in the current language. SectionBar.title is assigned
 * first because it is the documented property; the label is then reached
 * directly, because on this engine the property alone does not redraw. Each
 * step is guarded: a bar that cannot be re-titled keeps the language it opened
 * with, which is wrong but survivable, where a thrown error is not.
 */
function fxRetitleSection( bar )
{
   if ( bar == null || bar.__titleKey == null )
      return;
   let title = fxT( bar.__titleKey );
   try { bar.title = title; } catch ( x ) {}
   try { if ( bar.label != null ) bar.label.text = title; } catch ( x ) {}
   try { bar.repaint(); } catch ( x ) {}
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

   /*
    * Wide enough for the longest label the CURRENT language actually uses.
    * It was measured on one hard-coded English string, and French runs longer:
    * "Point des basses lumieres :" and "Niveaux de posterisation :" were both
    * clipped from the left, which reads as a rendering fault rather than a
    * layout one. Recomputed on every language change, before the rows re-read
    * their own labels.
    */
   this.measureLabelWidth = function()
   {
      let w = 0;
      for ( let name in FXRanges )
      {
         let t = fxT( name );
         if ( t != name )
            w = Math.max( w, this.font.width( t ) );
      }
      w = Math.max( w, this.font.width( fxT( "normalizeRef" ) ) );
      w = Math.max( w, this.font.width( fxT( "palette" ) ) );
      w = Math.max( w, this.font.width( fxT( "imageName" ) ) );
      this.labelWidth = w + this.logicalPixelsToPhysical( 8 );
   };
   this.measureLabelWidth();
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
                              ? (this.notice + "  -  " + fxT( "renderingShort" ))
                              : fxT( "rendering" );
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
   // Every row that can retranslate itself registers here, so applyLanguage does
   // not carry a list that has to be kept in step with the interface.
   this.translatableRows = [];
   this.fxRegisterRow = function( row )
   {
      this.translatableRows.push( row );
   };

   this.notice = "";

   /*
    * The banner says what the script will accept right now. With the auto
    * stretch off it is the flat refusal 3.0.0 introduced; with it on, that
    * refusal would be a lie - so it becomes what the stretch is for, and how
    * to tell whether it worked.
    */
   this.updatePreviewStatusBanner = function()
   {
      this.bannerLabel.text = FX.linearInput ? fxT( "bannerAuto" ) : fxT( "bannerLinear" );
   };

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
         note += "  -  " + fxT( "noteLevelsElsewhere" )
               + elsewhere.map( fxT ).join( ", " );
      // This script takes non-linear data only, and linear channels produce a
      // black preview with no explanation. Say so.
      // Only when nothing is going to stretch them. Telling a user to stretch
      // channels the script is about to stretch itself is how a warning stops
      // being read.
      if ( fxLooksLinear( FX ) && !FX.linearInput )
         note += "  -  " + fxT( "noteLinear" );
      else if ( FX.linearInput && !fxLooksLinear( FX ) )
         note += "  -  " + fxT( "noteAlreadyStretched" );
      // Appends, like its two neighbours. A bare assignment here discarded both
      // the capitalised linear-data warning and the off-screen-levels note
      // whenever a multiscale stage was on - silencing, in exactly the
      // configuration where the preview is least trustworthy, the only guard
      // rail left on the one input type this version does not support.
      // Only when the render really is downsampled. Unlike its neighbour below,
      // this used not to test the factor, so it warned about approximation at
      // Detail 1:1 - where there is none - and a warning that cries wolf is one
      // people learn to read past.
      if ( FX.hdrEnabled && (FX.hdrLayers > 0 || FX.localContrast > 0)
        && this.engine.factor > 1 )
         note += "  -  " + fxT( "noteMultiscale" );
      // A star's peak is a handful of pixels. If the resampling averaged them
      // away, the brightness stretch has nothing left to lift and the previewed
      // stars come out far dimmer than the ones Execute produces.
      if ( FX.previewTarget == 1 && FX.makeStars
        && this.engine.factor > 1
        && this.engine.starPeaksPreserved === false )
         note += "  -  " + fxT( "notePeaks" );

      let head = (this.notice.length > 0) ? (this.notice + "  -  ") : "";
      this.previewStatus.text = head
                             + format( fxT( "renderedAt" ),
                                        image.width, image.height, this.engine.factor,
                                        Math.round( this.preview.effectiveZoom() * 100 ) )
                             + note;
   };

   /*
    * The menu icon, painted at the header's left. Looked for where a dev
    * staging puts it, then beside the script, then where the package installs
    * it - four levels up from src/scripts/CaeloWorks/<Name>/ is the PixInsight
    * root. Sized in physical pixels so it follows the UI scaling of a
    * high-density display like every other control, and returns null on any
    * failure so the header simply loses its emblem rather than the dialog
    * failing to open.
    */
   this.makeEmblem = function()
   {
      let here = File.extractDrive( #__FILE__ ) + File.extractDirectory( #__FILE__ );
      let candidates = [ here + "/../assets/" + FX_ICON_NAME,
                         here + "/assets/" + FX_ICON_NAME,
                         here + "/" + FX_ICON_NAME,
                         // This file lives in lib/, so the PixInsight root is five
                         // levels up from src/scripts/CaeloWorks/<Name>/lib/.
                         here + "/../../../../../rsc/icons/script/ForaxxPaletteStudio/" + FX_ICON_NAME ];
      let px = (typeof this.logicalPixelsToPhysical == "function")
             ? this.logicalPixelsToPhysical( 44 ) : 44;
      let bmp = null;
      for ( let i = 0; i < candidates.length && bmp == null; ++i )
         try
         {
            if ( File.exists( candidates[i] ) )
            {
               let b = new Bitmap( candidates[i] );
               bmp = (typeof b.scaledTo == "function") ? b.scaledTo( px, px ) : b;
            }
         }
         catch ( x )
         {
            bmp = null;
         }
      if ( bmp == null )
         return null;
      let ctrl = new Control( this );
      ctrl.setScaledFixedSize( 44, 44 );
      ctrl.__bmp = bmp;
      ctrl.onPaint = function()
      {
         let g = new Graphics( this );
         try { g.drawBitmap( 0, 0, this.__bmp ); } catch ( x ) {}
         g.end();
      };
      return ctrl;
   };

   /*
    * Re-reads every string from the table. Called once at construction and
    * again on every language change - which is why the strings are not written
    * inline: a literal left in place is one that silently stays English, and
    * nothing on screen would say so.
    */
   this.applyLanguage = function()
   {
      this.byLabel.text = "<span style=\"color:#5a8fd0; text-decoration:underline;\">"
                        + fxT( "byLine" ) + "</span>";
      this.byLabel.toolTip = fxT( "byLineTip" ) + " \u2014 build " + VERSION;
      this.taglineLabel.text = "<i>" + fxT( "tagline" ) + "</i>";
      this.updatePreviewStatusBanner();
      this.langLabel.text = fxT( "language" );

      this.linearNote.text = fxT( "linearNote" );
      this.linearBar.toolTip = fxT( "linearBarTip" );
      this.linearMethodRow.combo.clear();
      this.linearMethodRow.combo.addItem( fxT( "linearMethodStf" ) );
      this.linearMethodRow.combo.addItem( fxT( "linearMethodStat" ) );
      this.linearMethodRow.combo.currentItem = FX.linearMethod;
      fxRetitleSection( this.linearBar );
      fxRetitleSection( this.generalBar );
      fxRetitleSection( this.paletteBar );
      fxRetitleSection( this.starsBar );
      fxRetitleSection( this.normalizeBar );
      fxRetitleSection( this.scnrBar );
      fxRetitleSection( this.hdrBar );
      fxRetitleSection( this.lumBar );
      fxRetitleSection( this.outputBar );
      this.normalizeBar.toolTip = fxT( "normalizeBarTip" );
      this.scnrBar.toolTip = fxT( "scnrBarTip" );
      this.hdrBar.toolTip = fxT( "hdrBarTip" );
      this.lumBar.toolTip = fxT( "lumBarTip" );

      this.refreshButton.text = fxT( "refresh" );
      this.resetAllButton.text = fxT( "resetAll" );
      this.executeButton.text = fxT( "execute" );
      this.cancelButton.text = fxT( "close" );
      this.reloadButton.text = fxT( "reloadList" );

      this.threeChannelRadio.text = fxT( "threeChannels" );
      this.twoChannelRadio.text = fxT( "twoChannels" );

      // Plain controls, whose tooltips are single strings rather than a row's
      // label-plus-body pair.
      this.styleLabel.text = fxT( "palette" );
      this.baseIdLabel.text = fxT( "imageName" );
      this.previewGroup.title = fxT( "preview" );
      this.zoomFitButton.text = fxT( "fit" );
      this.zoomOneButton.text = fxT( "oneToOne" );
      this.levelsAutoButton.text = fxT( "auto" );
      this.levelsResetButton.text = fxT( "reset" );

      // Both combos hold strings, so they are rebuilt and the selection put
      // back - the same treatment the palette list gets.
      let keptTarget = this.previewTargetCombo.currentItem;
      this.previewTargetCombo.clear();
      this.previewTargetCombo.addItem( fxT( "targetStarless" ) );
      this.previewTargetCombo.addItem( fxT( "targetStars" ) );
      this.previewTargetCombo.addItem( fxT( "targetLum" ) );
      this.previewTargetCombo.currentItem = keptTarget;

      let keptDetail = this.previewDetailCombo.currentItem;
      this.previewDetailCombo.clear();
      this.previewDetailCombo.addItem( fxT( "detailAuto" ) );
      this.previewDetailCombo.addItem( fxT( "detail11" ) );
      this.previewDetailCombo.addItem( fxT( "detail12" ) );
      this.previewDetailCombo.addItem( fxT( "detail14" ) );
      this.previewDetailCombo.addItem( fxT( "detail18" ) );
      this.previewDetailCombo.currentItem = keptDetail;

      this.styleCombo.toolTip = fxT( "styleNote" );
      this.styleLabel.toolTip = fxT( "styleNote" );
      this.starsNote.text = fxT( "starsNote" );
      this.scnrNote.text = fxT( "scnrNote" );
      this.lumNote.text = fxT( "lumNote" );
      let baseIdTip = fxT( "baseIdNote" );
      this.baseIdEdit.toolTip = baseIdTip;
      this.baseIdLabel.toolTip = baseIdTip;
      let zoomTip = fxT( "zoomNote" );
      this.zoomFitButton.toolTip = zoomTip;
      this.zoomOneButton.toolTip = zoomTip;
      this.zoomOutButton.toolTip = zoomTip;
      this.zoomInButton.toolTip = zoomTip;
      this.zoomReadout.toolTip = zoomTip;
      this.langCombo.toolTip = fxT( "languageTip" );
      this.threeChannelRadio.toolTip = fxT( "threeChannelRadioTip" );
      this.twoChannelRadio.toolTip = fxT( "twoChannelRadioTip" );
      this.reloadButton.toolTip = fxT( "reloadTip" );
      this.previewTargetCombo.toolTip = fxT( "previewTargetTip" );
      this.previewDetailCombo.toolTip = fxT( "previewDetailTip" );
      this.refreshButton.toolTip = fxT( "refreshTip" );
      this.levels.toolTip = fxT( "levelsTip" );
      this.levelsReadout.toolTip = fxT( "levelsReadoutTip" );
      this.levelsAutoButton.toolTip = fxT( "levelsAutoTip" );
      this.levelsResetButton.toolTip = fxT( "levelsResetTip" );
      this.newInstanceButton.toolTip = fxT( "newInstanceTip" );
      this.resetAllButton.toolTip = fxT( "resetAllTip" );
      this.executeButton.toolTip = fxT( "executeTip" );
      this.cancelButton.toolTip = fxT( "cancelTip" );

      // The palette list is rebuilt rather than retranslated in place: the item
      // model holds strings, and the selection has to survive the rebuild.
      let keep = this.styleCombo.currentItem;
      this.styleCombo.clear();
      let map = this.styleMap;
      if ( map == null )
      {
         map = [];
         for ( let i = 0; i < FXStyles.length; ++i )
            map.push( i );
      }
      for ( let i = 0; i < map.length; ++i )
         this.styleCombo.addItem( this.styleName( FXStyles[ map[i] ] ) );
      if ( keep >= 0 && keep < map.length )
         this.styleCombo.currentItem = keep;

      this.measureLabelWidth();
      this.styleLabel.setFixedWidth( this.labelWidth );
      this.baseIdLabel.setFixedWidth( this.labelWidth );
      for ( let i = 0; i < this.translatableRows.length; ++i )
         this.translatableRows[i].retranslate();
   };

   /* ==========================================================================
    * Header
    * ========================================================================== */

   // Emblem, name, tagline, and the language selector. The same shape every
   // CaeloWorks script wears, so a user who knows one recognises the next.
   this.emblem = this.makeEmblem();

   this.titleLabel = new Label( this );
   this.titleLabel.text = TITLE;
   let tf = this.titleLabel.font;
   tf.bold = true;
   tf.pointSize = Math.round( this.font.pointSize * 1.7 );
   this.titleLabel.font = tf;

   this.byLabel = new Label( this );
   this.byLabel.useRichText = true;
   this.byLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.byLabel.onMousePress = function()
   {
      fxOpenInBrowser( "https://pixinsight-scripts.caelo.works/" );
   };
   try { this.byLabel.cursor = new Cursor( StdCursor_PointingHand ); } catch ( x ) {}

   this.taglineLabel = new Label( this );
   this.taglineLabel.useRichText = true;
   this.taglineLabel.wordWrapping = true;

   this.titleColumn = new VerticalSizer;
   this.titleColumn.add( this.titleLabel );
   this.titleColumn.add( this.byLabel );

   this.langLabel = new Label( this );
   this.langLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.langCombo = new ComboBox( this );
   this.langCombo.addItem( "English" );
   this.langCombo.addItem( "Fran\u00e7ais" );
   // An explicit width. Sharing a row with addStretch(), a combo with no width
   // of its own can be squeezed to nothing - which is what happened here, and
   // an invisible control looks exactly like one that was never built.
   this.langCombo.setScaledFixedWidth( 110 );
   this.langCombo.currentItem = (FX.lang == "fr") ? 1 : 0;
   this.langCombo.onItemSelected = function( index )
   {
      FX.lang = (index == 1) ? "fr" : "en";
      dlg.applyLanguage();
   };

   this.headerSizer = new HorizontalSizer;
   this.headerSizer.spacing = 10;
   if ( this.emblem != null )
      this.headerSizer.add( this.emblem );
   this.headerSizer.add( this.titleColumn );
   this.headerSizer.addStretch();
   this.headerSizer.add( this.langLabel );
   this.headerSizer.addSpacing( 4 );
   this.headerSizer.add( this.langCombo );

   // The non-linear requirement keeps its own line, below the identity block.
   // It is the one thing on this dialog a user must read before running.
   this.bannerLabel = new Label( this );
   this.bannerLabel.useRichText = true;
   this.bannerLabel.wordWrapping = true;

   // The three rows go straight into the dialog's own sizer. Wrapping them in an
   // intermediate Control laid out everything before the stretch and dropped
   // everything after it off the right edge - the language selector rendered
   // nowhere at all, with no error to say so.

   /* ==========================================================================
    * Data: how many channels, stars or not, and which palette
    * ========================================================================== */

   this.threeChannelRadio = new RadioButton( this );
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
   this.twoChannelRadio.onCheck = function( checked )
   {
      if ( !checked || dlg.syncing )
         return;
      fxSetChannelCount( true );
      dlg.pullFromParameters();
      dlg.updateControls();
      dlg.requestPreview();
   };

   this.starlessOnlyCheck = fxCheckBox( this, "starlessOnly",
      !FX.makeStars,
      function( checked )
      {
         FX.makeStars = !checked;
         dlg.updateControls();
         dlg.requestPreview();
      } , this );

   let dataSizer = new HorizontalSizer;
   dataSizer.spacing = 10;
   dataSizer.add( this.threeChannelRadio );
   dataSizer.add( this.twoChannelRadio );
   dataSizer.addStretch();

   this.styleLabel = new Label( this );
   this.styleLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.styleLabel.setFixedWidth( this.labelWidth );

   // The palette's display name comes from the string table under the style's
   // own key, and falls back to the English name carried by the table itself -
   // so a style added without a translation still reads, rather than showing a
   // bare key in the one control the user cannot avoid.
   this.styleName = function( style )
   {
      let t = fxT( style.key );
      return (t === style.key) ? style.name : t;
   };

   this.styleCombo = new ComboBox( this );
   for ( let i = 0; i < FXStyles.length; ++i )
      this.styleCombo.addItem( this.styleName( FXStyles[i] ) );
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
                  this.styleCombo.addItem( this.styleName( FXStyles[i] ) );
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
         this.setNotice( format( fxT( "noticeLevelsReset" ),
                                 cleared.map( fxT ).join( ", " ) ) );
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

   /* ==========================================================================
    * General section
    *
    * The three choices that decide what everything below means: how many
    * channels you have, whether a stars image is built, and which palette. They
    * used to sit loose above the first section bar, which made them look like
    * part of the banner rather than the first thing to set.
    * ========================================================================== */

   // One section, not two. How many channels you have and which images they are
   // is a single decision taken in two steps, and "Starless only" is what greys
   // the three star selectors sitting beside them. The palette leads it because
   // it decides what everything below means.
   this.generalControl = fxGroupControl( this );
   this.generalControl.sizer.add( dataSizer );
   this.generalControl.sizer.add( this.starlessOnlyCheck );
   this.generalControl.sizer.addSpacing( 4 );
   this.generalControl.sizer.add( styleSizer );
   this.generalControl.sizer.addSpacing( 6 );
   this.generalControl.sizer.add( this.siiRow.sizer );
   this.generalControl.sizer.add( this.haRow.sizer );
   this.generalControl.sizer.add( this.oiiiRow.sizer );

   let reloadSizer = new HorizontalSizer;
   reloadSizer.addStretch();
   reloadSizer.add( this.reloadButton );
   this.generalControl.sizer.add( reloadSizer );

   this.generalBar = fxSection( this, "secGeneral", this.generalControl, false );

   /* ==========================================================================
    * Linear input section
    *
    * Ahead of Channel normalization, because it runs first in the pipeline and
    * because the two compose: the auto stretch supplies the absolute level, and
    * normalization then places the channels relative to it.
    * ========================================================================== */

   this.linearMethodRow = fxComboRow( this, "linearMethod",
      [ fxT( "linearMethodStf" ), fxT( "linearMethodStat" ) ],
      FX.linearMethod,
      function( index )
      {
         if ( dlg.syncing ) return;
         FX.linearMethod = index;
         dlg.updateControls();
         dlg.requestPreview();
      } );

   this.linearTargetRow = fxNumericRow( this, "linearTarget",
      function( value ) { FX.linearTarget = value; dlg.requestPreview(); } );

   this.linearClipRow = fxNumericRow( this, "linearClip",
      function( value ) { FX.linearClip = value; dlg.requestPreview(); } );

   this.linearNoClipCheck = fxCheckBox( this, "linearNoClip", FX.linearNoClip,
      function( checked ) { FX.linearNoClip = checked; dlg.requestPreview(); }, this );




   this.linearNote = new Label( this );
   this.linearNote.useRichText = true;
   this.linearNote.wordWrapping = true;

   this.linearControl = fxGroupControl( this );
   this.linearControl.sizer.add( this.linearNote );
   this.linearControl.sizer.add( this.linearMethodRow );
   this.linearControl.sizer.add( this.linearTargetRow );
   this.linearControl.sizer.add( this.linearClipRow );
   this.linearControl.sizer.add( this.linearNoClipCheck );

   this.linearBar = new SectionBar( this, fxT( "secLinear" ) );
   this.linearBar.__titleKey = "secLinear";
   this.linearBar.onToggleSection = fxKeepWindowSize( this );
   this.linearBar.setSection( this.linearControl );
   this.linearBar.enableCheckBox();
   this.linearBar.checkBox.checked = FX.linearInput;
   // onCheckSection, not onCheck: SectionBar fires the former for its own
   // checkbox. Wired to the latter, the handler never ran at all - the switch
   // moved on screen and nothing behind it changed.
   this.linearBar.onCheckSection = function( bar )
   {
      FX.linearInput = bar.checkBox.checked;
      dlg.updatePreviewStatusBanner();
      dlg.updateControls();
      dlg.requestPreview();
   };
   if ( !FX.linearInput )
      this.linearControl.hide();

   /* ==========================================================================
    * Channel normalization section
    * ========================================================================== */

   this.normRefRow = fxComboRow( this, "normalizeRef", [ "Sii", "Ha", "Oiii" ],
      FX.normalizeRef,
      function( index )
      {
         if ( dlg.syncing ) return;
         FX.normalizeRef = index;
         dlg.requestPreview();
      } );

   this.normSiiRow = fxNumericRow( this, "normSii",
      function( value ) { FX.normSii = value; dlg.requestPreview(); } );

   this.normHaRow = fxNumericRow( this, "normHa",
      function( value ) { FX.normHa = value; dlg.requestPreview(); } );

   this.normOiiiRow = fxNumericRow( this, "normOiii",
      function( value ) { FX.normOiii = value; dlg.requestPreview(); } );

   this.normShadowRow = fxNumericRow( this, "normShadow",
      function( value ) { FX.normShadow = value; dlg.requestPreview(); } );

   this.normalizeControl = fxGroupControl( this );
   this.normalizeControl.sizer.add( this.normRefRow );
   this.normalizeControl.sizer.add( this.normSiiRow );
   this.normalizeControl.sizer.add( this.normHaRow );
   this.normalizeControl.sizer.add( this.normOiiiRow );
   this.normalizeControl.sizer.add( this.normShadowRow );

   this.normalizeBar = new SectionBar( this, fxT( "secNormalize" ) );
   this.normalizeBar.__titleKey = "secNormalize";
   this.normalizeBar.onToggleSection = fxKeepWindowSize( this );
   this.normalizeBar.setSection( this.normalizeControl );
   this.normalizeBar.enableCheckBox();
   this.normalizeBar.checkBox.checked = FX.normalizeEnabled;
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

   this.gainSiiRow = fxNumericRow( this, "gainSii",
      function( value ) { FX.gainSii = value; dlg.requestPreview(); } );

   this.gainHaRow = fxNumericRow( this, "gainHa",
      function( value ) { FX.gainHa = value; dlg.requestPreview(); } );

   this.gainOiiiRow = fxNumericRow( this, "gainOiii",
      function( value ) { FX.gainOiii = value; dlg.requestPreview(); } );

   this.blendRow = fxNumericRow( this, "blend",
      function( value ) { FX.blend = value; dlg.requestPreview(); } );

   this.hardORow = fxNumericRow( this, "hardO",
      function( value ) { FX.hardO = value; dlg.requestPreview(); } );

   this.hardHORow = fxNumericRow( this, "hardHO",
      function( value ) { FX.hardHO = value; dlg.requestPreview(); } );

   this.curveRow = fxNumericRow( this, "curveStrength",
      function( value ) { FX.curveStrength = value; dlg.requestPreview(); } );

   this.satRow = fxNumericRow( this, "satStrength",
      function( value ) { FX.satStrength = value; dlg.requestPreview(); } );

   this.extraSatRow = fxNumericRow( this, "extraSaturation",
      function( value ) { FX.extraSaturation = value; dlg.requestPreview(); } );

   this.posterRow = fxNumericRow( this, "posterLevels",
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

   this.paletteBar = fxSection( this, "secWeighting", this.paletteControl, false );

   /* ==========================================================================
    * Stars section
    * ========================================================================== */

   this.starsNote = new Label( this );
   this.starsNote.useRichText = true;
   this.starsNote.wordWrapping = true;

   this.starCleanGreenCheck = fxCheckBox( this, "starCleanGreen",
      FX.starCleanGreen,
      function( checked ) { FX.starCleanGreen = checked; dlg.requestPreview(); } , this );

   this.starStretchRow = fxNumericRow( this, "starStretch",
      function( value ) { FX.starStretch = value; dlg.requestPreview(); } );

   this.starSatRow = fxNumericRow( this, "starSaturation",
      function( value ) { FX.starSaturation = value; dlg.requestPreview(); } );

   this.starsControl = fxGroupControl( this );
   this.starsControl.sizer.add( this.starsNote );
   this.starsControl.sizer.addSpacing( 4 );
   this.starsControl.sizer.add( this.starCleanGreenCheck );
   this.starsControl.sizer.add( this.starStretchRow );
   this.starsControl.sizer.add( this.starSatRow );

   this.starsBar = fxSection( this, "secStars", this.starsControl, false );

   /* ==========================================================================
    * Green / magenta suppression section
    * ========================================================================== */

   this.scnrNote = new Label( this );
   this.scnrNote.useRichText = true;
   this.scnrNote.wordWrapping = true;

   this.greenRow = fxNumericRow( this, "scnrGreen",
      function( value ) { FX.scnrGreen = value; dlg.requestPreview(); } );

   this.magentaRow = fxNumericRow( this, "scnrMagenta",
      function( value ) { FX.scnrMagenta = value; dlg.requestPreview(); } );

   this.preserveLightnessCheck = fxCheckBox( this, "scnrPreserveL",
      FX.scnrPreserveL,
      function( checked ) { FX.scnrPreserveL = checked; dlg.requestPreview(); } , this );

   this.scnrControl = fxGroupControl( this );
   this.scnrControl.sizer.add( this.scnrNote );
   this.scnrControl.sizer.addSpacing( 4 );
   this.scnrControl.sizer.add( this.greenRow );
   this.scnrControl.sizer.add( this.magentaRow );
   this.scnrControl.sizer.addSpacing( 2 );
   this.scnrControl.sizer.add( this.preserveLightnessCheck );

   this.scnrBar = new SectionBar( this, fxT( "secScnr" ) );
   this.scnrBar.__titleKey = "secScnr";
   this.scnrBar.onToggleSection = fxKeepWindowSize( this );
   this.scnrBar.setSection( this.scnrControl );
   this.scnrBar.enableCheckBox();
   this.scnrBar.checkBox.checked = FX.scnrEnabled;
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

   this.hdrAmountRow = fxNumericRow( this, "hdrAmount",
      function( value ) { FX.hdrAmount = value; dlg.requestPreview(); } );

   this.hdrKneeRow = fxNumericRow( this, "hdrKnee",
      function( value ) { FX.hdrKnee = value; dlg.requestPreview(); } );

   this.hdrLayersRow = fxNumericRow( this, "hdrLayers",
      function( value ) { FX.hdrLayers = Math.round( value ); dlg.requestPreview(); } );

   this.localContrastRow = fxNumericRow( this, "localContrast",
      function( value ) { FX.localContrast = value; dlg.requestPreview(); } );

   this.hdrControl = fxGroupControl( this );
   this.hdrControl.sizer.add( this.hdrAmountRow );
   this.hdrControl.sizer.add( this.hdrKneeRow );
   this.hdrControl.sizer.add( this.hdrLayersRow );
   this.hdrControl.sizer.add( this.localContrastRow );

   this.hdrBar = new SectionBar( this, fxT( "secHdr" ) );
   this.hdrBar.__titleKey = "secHdr";
   this.hdrBar.onToggleSection = fxKeepWindowSize( this );
   this.hdrBar.setSection( this.hdrControl );
   this.hdrBar.enableCheckBox();
   this.hdrBar.checkBox.checked = FX.hdrEnabled;
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

   this.lumApplyRow = fxNumericRow( this, "lumApply",
      function( value ) { FX.lumApply = value; dlg.requestPreview(); } );

   this.lumControl = fxGroupControl( this );
   this.lumControl.sizer.add( this.lumNote );
   this.lumControl.sizer.addSpacing( 4 );
   this.lumControl.sizer.add( this.lumApplyRow );

   this.lumBar = new SectionBar( this, fxT( "secLuminance" ) );
   this.lumBar.__titleKey = "secLuminance";
   this.lumBar.onToggleSection = fxKeepWindowSize( this );
   this.lumBar.setSection( this.lumControl );
   this.lumBar.enableCheckBox();
   this.lumBar.checkBox.checked = FX.makeLuminance;
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
   this.baseIdLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.baseIdLabel.setFixedWidth( this.labelWidth );

   this.baseIdEdit = new Edit( this );
   this.baseIdEdit.text = FX.baseId;
   this.baseIdEdit.onEditCompleted = function()
   {
      FX.baseId = this.text.trim();
      this.text = FX.baseId;
   };

   let baseIdSizer = new HorizontalSizer;
   baseIdSizer.spacing = 4;
   baseIdSizer.add( this.baseIdLabel );
   baseIdSizer.add( this.baseIdEdit, 100 );

   this.combinedCheck = fxCheckBox( this, "makeCombined",
      FX.makeCombined,
      function( checked ) { FX.makeCombined = checked; } , this );

   this.factorsCheck = fxCheckBox( this, "makeFactors",
      FX.makeFactors,
      function( checked ) { FX.makeFactors = checked; } , this );

   this.outputControl = fxGroupControl( this );
   this.outputControl.sizer.add( baseIdSizer );
   this.outputControl.sizer.add( this.combinedCheck );
   this.outputControl.sizer.add( this.factorsCheck );

   this.outputBar = fxSection( this, "secOutput", this.outputControl, false );

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

   this.zoomFitButton = new PushButton( this );
   this.zoomFitButton.setScaledMinWidth( 34 );
   this.zoomFitButton.onClick = function()
   {
      FX.previewFit = true;
      dlg.applyZoom();
   };

   this.zoomOneButton = new PushButton( this );
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
   this.zoomOutButton.setScaledMinWidth( 26 );
   this.zoomOutButton.onClick = function()
   {
      if ( dlg.preview.zoomAboutCentre( dlg.preview.zoomOutStep ) )
         dlg.preview.notifyZoom();
   };

   this.zoomInButton = new PushButton( this );
   this.zoomInButton.text = "+";
   this.zoomInButton.setScaledMinWidth( 26 );
   this.zoomInButton.onClick = function()
   {
      if ( dlg.preview.zoomAboutCentre( dlg.preview.zoomInStep ) )
         dlg.preview.notifyZoom();
   };

   this.zoomReadout = new Label( this );
   this.zoomReadout.text = fxT( "fit" );
   this.zoomReadout.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.zoomReadout.setScaledMinWidth( 54 );

   this.previewDetailCombo = new ComboBox( this );
   this.previewDetailCombo.onItemSelected = function( index )
   {
      if ( dlg.syncing ) return;
      FX.previewDetail = index;
      dlg.refreshPreview();
   };

   this.autoPreviewCheck = fxCheckBox( this, "autoPreview",
      FX.autoPreview,
      function( checked )
      {
         FX.autoPreview = checked;
         if ( checked )
            dlg.requestPreview();
      } , this );

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh";
   fxSetIcon( this, this.refreshButton, ":/icons/reload.png", null );
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
   this.previewStatus.text = fxT( "selectChannels" );
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
      { titleKey: "levelsStarless",       low: "levelsLow",
        mid: "levelsMid",     high: "levelsHigh" },
      { titleKey: "levelsStars",          low: "starLevelsLow",
        mid: "starLevelsMid", high: "starLevelsHigh" },
      { titleKey: "levelsLum",            low: "lumLow",
        mid: "lumMid",        high: "lumHigh" }
   ];

   this.levelKeys = function()
   {
      return FX_LEVEL_KEYS[ fxClamp( FX.previewTarget, 0, FX_LEVEL_KEYS.length - 1 ) ];
   };

   this.levels = new FXLevelsControl( this );
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

   this.updateLevelsReadout = function()
   {
      let k = this.levelKeys();
      this.levelsReadout.text = format( fxT( "levelsReadout" ),
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
      this.levelsGroup.title = fxT( k.titleKey );
      this.levels.setValues( FX[k.low], FX[k.mid], FX[k.high] );
      this.updateLevelsReadout();
   };

   this.levelsAutoButton = new PushButton( this );
   this.levelsAutoButton.onClick = function()
   {
      let v = dlg.levels.autoValues();
      if ( v == null )
      {
         dlg.setNotice( fxT( "noHistogram" ) );
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
   this.levelsGroup.title = fxT( "levelsStarless" );
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
      let px = Math.round( w * this.uiScale );
      this.leftScroll.setFixedWidth( px );
      this.updateLeftScroll();
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
         this.previewStatus.text = fxT( "renderFailed" );
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
      this.setNotice( format( fxT( "noticeCreated" ),
                              created.starless
                              + (created.stars ? (", " + created.stars) : "")
                              + (created.combined ? (", " + created.combined) : "")
                              + (created.luminance ? (", " + created.luminance) : "") ) );
   };

   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Close";
   fxSetIcon( this, this.cancelButton, ":/icons/close.png", null );
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

   // Everything the column holds, in order, so its height can be measured.
   this.leftItems = [];
   this.fxAddLeft = function( control )
   {
      this.leftItems.push( control );
      this.leftSizer.add( control );
   };
   this.fxAddLeft( this.generalBar );
   this.fxAddLeft( this.generalControl );
   this.fxAddLeft( this.linearBar );
   this.fxAddLeft( this.linearControl );
   this.fxAddLeft( this.normalizeBar );
   this.fxAddLeft( this.normalizeControl );
   this.fxAddLeft( this.paletteBar );
   this.fxAddLeft( this.paletteControl );
   this.fxAddLeft( this.starsBar );
   this.fxAddLeft( this.starsControl );
   this.fxAddLeft( this.scnrBar );
   this.fxAddLeft( this.scnrControl );
   this.fxAddLeft( this.hdrBar );
   this.fxAddLeft( this.hdrControl );
   this.fxAddLeft( this.lumBar );
   this.fxAddLeft( this.lumControl );
   this.fxAddLeft( this.outputBar );
   this.fxAddLeft( this.outputControl );
   this.leftSizer.addStretch();

   /*
    * The settings column scrolls.
    *
    * The hard part is not the ScrollBox, it is measuring the column. A panel
    * inside a viewport is squeezed to the room available, and a height measured
    * from a squeezed panel measures the squeeze - two earlier attempts died
    * there, the second reporting sections of 38 pixels that need 100 to 250,
    * with minHeight coming back as 0 and no natural height to be had from PJSR.
    *
    * So the panel is made enormous first. With room to spare nothing is
    * compressed, every control settles at its own size, and THAT is what gets
    * measured. The panel is then set to the measured height and the viewport
    * becomes a window onto something genuinely bigger than itself.
    *
    * The sliding is manual. A ScrollBox keeps a position and draws a bar, but
    * it does not move its viewport's children - measured, not assumed: with the
    * range at 0..974 and the position driven to 300, the panel stayed at y 0.
    * So the bar and the wheel both end up in scrollLeftTo(), the one place the
    * offset is applied.
    */
   this.leftScroll = new ScrollBox( this );
   this.leftScroll.autoScroll = false;
   this.leftScroll.tracking = true;
   // Scroll bars are not automatic: a ScrollBox hides both until asked. Setting
   // a range on a hidden bar changes nothing anyone can see, which is why the
   // column scrolled to the wheel long before it grew a bar to drag.
   this.leftScroll.showScrollBars( false/*horizontal*/, true/*vertical*/ );
   // The panel belongs to no sizer: a sizer would put it straight back at the
   // next layout pass, and move() has to hold.
   this.leftPanel = new Control( this.leftScroll.viewport );
   this.leftPanel.sizer = this.leftSizer;

   this.scrollLeftTo = function( pos )
   {
      let overflow = Math.max( 0, this.leftScroll.maxVerticalScrollPosition );
      pos = Math.max( 0, Math.min( overflow, Math.round( pos ) ) );
      this.__leftScrollPos = pos;
      try
      {
         if ( this.leftScroll.verticalScrollPosition != pos )
            this.leftScroll.verticalScrollPosition = pos;
         this.leftPanel.move( 0, -pos );
      }
      catch ( x ) {}
   };

   // Far taller than any column of sections could be, and only ever in force
   // for the instant it takes the layout to settle.
   this.__roomToBreathe = 20000;
   this.__leftScrollPos = 0;
   this.__leftLineHeight = 24;

   this.measureLeftColumn = function()
   {
      let content = 0;
      for ( let i = 0; i < this.leftItems.length; ++i )
      {
         let it = this.leftItems[i];
         if ( it != null && it.visible )
            content += it.height + this.leftSizer.spacing;
      }
      return content;
   };

   this.updateLeftScroll = function()
   {
      if ( this.leftScroll == null || this.leftPanel == null )
         return;
      try
      {
         // Give it room, let the layout run, then measure what the controls
         // chose for themselves rather than what they were forced into.
         this.leftPanel.setFixedHeight( this.__roomToBreathe );
         processEvents();
         let content = this.measureLeftColumn();
         if ( content < 1 )
            return;

         let visible = Math.max( 1, this.leftScroll.viewport.height );
         let width = Math.max( 1, this.leftScroll.viewport.width );
         let height = Math.max( content, visible );
         // Nothing lays the panel out, so its size is set outright: as wide as
         // the viewport, as tall as the column really needs.
         this.leftPanel.setFixedSize( width, height );
         processEvents();

         let overflow = Math.max( 0, content - visible );
         // Range first, page second. Setting the page before the range leaves
         // it to be clamped by whatever range follows, and a page as large as
         // its range gives a thumb that fills the track.
         this.leftScroll.setHorizontalScrollRange( 0, 0 );
         this.leftScroll.setVerticalScrollRange( 0, overflow );
         this.leftScroll.pageHeight = visible;
         // Isolated: a wheel/arrow step is a nicety, not worth aborting the
         // range update for if this build spells the property differently.
         this.__leftLineHeight = Math.max( 8, Math.round( visible/20 ) );
         try { this.leftScroll.lineHeight = this.__leftLineHeight; } catch ( x ) {}
         this.scrollLeftTo( this.__leftScrollPos );
      }
      catch ( x )
      {
      }
   };

   this.leftScroll.viewport.onResize = function()
   {
      dlg.updateLeftScroll();
   };
   this.leftScroll.onVerticalScrollPosUpdated = function( pos )
   {
      dlg.scrollLeftTo( pos );
   };
   // A wheel notch is 120 eighths of a degree; three lines per notch is the
   // usual desktop feel.
   this.leftScroll.viewport.onMouseWheel = function( x, y, delta )
   {
      dlg.scrollLeftTo( dlg.__leftScrollPos - delta/120 * 3 * dlg.__leftLineHeight );
   };

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
   this.columnsSizer.add( this.leftScroll );
   this.columnsSizer.addSpacing( 2 );
   this.columnsSizer.add( this.sideSplitter );
   this.columnsSizer.addSpacing( 2 );
   this.columnsSizer.add( this.rightPanel, 100 );

   // Every control exists by now, so the table can be read into all of them.
   this.applyLanguage();

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add( this.headerSizer );
   this.sizer.add( this.taglineLabel );
   this.sizer.add( this.bannerLabel );
   this.sizer.addSpacing( 2 );
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
      // "Never clip the black point" is implied by the statistical stretch and
      // only means something for the screen transfer one.
      this.linearNoClipCheck.enabled = FX.linearMethod == 0;

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

   // Nothing reports itself visible before the dialog is shown, so the column
   // cannot be measured until then.
   this.onShow = function()
   {
      this.updateLeftScroll();
   };
}

ForaxxStudioDialog.prototype = new Dialog;

#endif   // __FX_Dialog_js
