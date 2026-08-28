// SPDX-License-Identifier: CC-BY-NC-4.0
/*
 ******************************************************************************
 * Foraxx Palette Studio
 *
 * ForaxxPaletteStudio.js
 *
 * A dynamic narrowband palette tool for PixInsight, with a live preview,
 * per-channel weighting, adjustable transition behaviour and hue-selective,
 * lightness-preserving green / magenta suppression.
 *
 * ---------------------------------------------------------------------------
 * THIS SCRIPT REQUIRES NON-LINEAR (STRETCHED) IMAGES.
 * ---------------------------------------------------------------------------
 *
 * FEED IT NON-LINEAR DATA ONLY. Stretch every channel before you run this -
 * with HistogramTransformation, a masked stretch, or whatever you normally use.
 * LINEAR DATA IS NOT SUPPORTED and will produce a black or washed-out result.
 * The status line under the preview says so if the selected channels look
 * linear.
 *
 * With three channels supply Sii, Ha and Oiii; with two supply Ha and Oiii.
 * Star images are optional - tick "Starless images only" if you do not have
 * them.
 *
 * ---------------------------------------------------------------------------
 * Credit and licence
 * ---------------------------------------------------------------------------
 *
 * This notice is kept because the licences of the works below require it. It is
 * not shown anywhere in the interface.
 *
 * The dynamic combination maths and the signature curves derive from the Foraxx
 * Palette Utility by Paul Hancock (Copyright (C) 2023-2024), which implements
 * the dynamic PixelMath expressions published by Bill Blanshan at
 * thecoldestnights.com.
 *
 * The statistical stretch black point handling, the knee-based highlight
 * compression and the broadband star combination derive from work by Franklin
 * Marek (SetiAstro, www.setiastro.com) - the statisticalstretch and
 * NBtoRGBStars scripts - used with attribution under CC BY-NC 4.0.
 *
 * The channel normalization follows the published method of the
 * NarrowbandNormalization process by Mike Cranfield, implemented from its
 * documentation rather than from the module.
 *
 * This product is based on software from the PixInsight project, developed by
 * Pleiades Astrophoto and its contributors (https://pixinsight.com/).
 *
 * ---------------------------------------------------------------------------
 * Version history
 * ---------------------------------------------------------------------------
 * 2.0.0   2026-08-25  First release. Live preview, channel weighting,
 *                     adjustable transitions, scalable curves and saturation,
 *                     hue-selective green / magenta suppression, presets,
 *                     settings persistence and process icon support.
 * 2.1.0   2026-08-25  Palette modes (dynamic SHO/HOO plus every fixed
 *                     mapping), per-slider reset buttons, tooltips on every
 *                     control, a draggable histogram driving a levels
 *                     transform, independent star stretch and saturation,
 *                     linear input with an STF-style auto stretch, and HDR
 *                     compression, HDRMultiscaleTransform and local contrast.
 *                     Fixed: the stars stretch was applied to the hue channel,
 *                     where it had no visible effect on a near-neutral stars
 *                     image; it now acts on RGB/K.
 * 2.2.0   2026-08-25  Palette and preset merged into one style list, each
 *                     carrying its own output name, with the channel count and
 *                     starless choice back at the top. Added the Andy Warhol
 *                     style with overall saturation and posterisation, the
 *                     statistical stretch and knee-based HDR compression, the
 *                     broadband star
 *                     combination, an artificial
 *                     luminance layer, mouse wheel zoom, a line-drawn
 *                     histogram, and draggable splitters for the side bar and
 *                     the histogram.
 * 2.3.0   2026-08-25  Zoom is now a display transform - it scales the rendered
 *                     preview instead of running the pipeline again - with a
 *                     separate Detail control for the render sampling. Added
 *                     channel normalization, and a Background cast protection
 *                     mode. Execute no longer closes the dialog, so several
 *                     palettes can be built in one sitting.
 *                     Fixed: in HOO, OHH and the dynamic HOO the per-pixel
 *                     green and magenta suppression was provably a no-op,
 *                     because green there is a blend of the same channels that
 *                     make red and blue and so can never exceed either.
 * 2.3.1   2026-08-25  The star finishing chain - green removal, the hyperbolic
 *                     brightness stretch and the colour boost - is now shared
 *                     by both star combinations instead of belonging to the NB
 *                     to RGB one. Fixed: the Foraxx star path finished with a
 *                     curve that is very nearly the identity, so a star at 0.01
 *                     came out at 0.06 where the broadband path put it at 0.71.
 * 2.3.2   2026-08-27  The preview zoom is continuous and anchored on the
 *                     cursor: one
 *                     wheel notch multiplies the scale by 1.25 or 0.8 and the
 *                     pixel under the pointer stays under the pointer, instead
 *                     of jumping between six fixed steps about the centre of
 *                     the panel. Fit, 1:1 and step buttons replace the zoom
 *                     list, double click returns to Fit, and panning can no
 *                     longer push the image out of the panel.
 * 2.3.3   2026-08-27  HDR and local contrast is now a switched section, off by
 *                     default with every amount at zero, so nothing in it runs
 *                     unless it is asked for. The green / magenta suppression
 *                     stage no longer touches the star image at all: the stars
 *                     have their own green removal in the Stars section, and
 *                     the nebula's correction was flattening real broadband
 *                     star colour into grey.
 * 2.3.4   2026-08-27  Fixed: on linear input the nebula came out black while
 *                     the stars looked right. The midtones balance the auto
 *                     stretch solves for was clamped at 0.001 - about forty
 *                     times larger than a sky background of 3e-5 needs - and
 *                     the expression writer could only emit six decimals, so a
 *                     balance of 2.5e-5 kept two significant figures and one of
 *                     3e-6 kept none. The background landed at 0.008 instead of
 *                     the requested 0.25. The stars hid it, because the star
 *                     finishing chain lifts by 3^5 = 243 on top of the stretch
 *                     and rescues almost anything.
 *                     Also fixed: with Channel normalization ticked as well,
 *                     the target came from the reference channel's raw linear
 *                     median, pinning every channel to the 0.001 clamp - 250x
 *                     darker still. The auto stretch now warns instead of
 *                     silently leaving a channel linear.
 * 2.3.5   2026-08-27  Fixed: previewed stars looked nothing like the ones
 *                     Execute produced. The preview downsampled the star
 *                     channels by averaging before the star finishing chain
 *                     multiplied by 3^5 = 243. A star is a handful of bright
 *                     pixels, so averaging a 1:8 block diluted a peak of 0.05
 *                     to 0.0033 and the stretch had nothing left to lift: the
 *                     previewed star reached 0.43 where the final one reached
 *                     0.93. The star channels are now downsampled peak-first,
 *                     which takes the worst gap from 0.60 to 0.0013, and the
 *                     status line says so if PixInsight declines the request.
 * 2.4.0   2026-08-27  The star adjustments follow the published broadband method again,
 *                     its defaults. Since 2.3.1 the brightness stretch had been
 *                     applied unconditionally at 3^5 = 243, where the reference
 *                     ships it behind an unticked "Apply Star Stretch
 *                     (Recommended)" box. That was survivable while the linear
 *                     auto stretch was broken and delivered channels thirty
 *                     times too dark; once 2.3.4 fixed that, 243 on top of a
 *                     properly exposed channel drove every star core to flat
 *                     white. The stretch and its colour boost are now one
 *                     optional stage, off by default; green removal stays on;
 *                     the per-channel background subtraction added in 2.3.1 is
 *                     gone, because the reference does not do it and with the
 *                     stretch off there is nothing for it to protect against.
 *                     NB to RGB is now the default combination.
 * 2.5.0   2026-08-27  Fewer choices, better defaults.
 *                     The stars are one fixed
 *                     combination at that script's own ratios, its four-step
 *                     green removal, and no other control. The star masks
 *                     option, the Ha/Oiii ratio, the brightness stretch and the
 *                     colour boost are gone - tuning them was what kept
 *                     producing star fields that did not look like the
 *                     reference.
 *                     Green / magenta suppression is PixInsight's SCNR at
 *                     average neutral, with no mode selector: the three
 *                     protection modes, the hue selectivity weight and the
 *                     background-cast correction are gone.
 *                     The artificial luminance is ChannelExtraction in CIE
 *                     L*a*b*, taking L - what Image > Extract > Lightness does -
 *                     with no method selector.
 *                     The preview can show the luminance layer on its own.
 *                     Every palette now carries both transitions, with the
 *                     Foraxx amount at 0 on the fixed ones so they start out
 *                     exactly as they were; the Sii/Ha transition greys out on
 *                     a palette with no Sii. The transitions belong to the RGB
 *                     slots rather than to the channels, so raising the amount
 *                     on a fixed palette arrives exactly at the Foraxx palette
 *                     with the same mapping. A settings file or process icon
 *                     from an earlier version is migrated, because the fixed
 *                     palettes used to store an amount of 1.00 that nothing
 *                     read.
 * 2.6.0   2026-08-27  The artificial luminance carries its own black point,
 *                     stretch amount and white point. The histogram under the
 *                     preview drives the colour image and is applied after the
 *                     layer has already been extracted, so the layer came out
 *                     as flat as the data arrived - and that flat layer was
 *                     then substituted back into the colour image. The new
 *                     controls act before the substitution, and the preview
 *                     Luminance target shows exactly what Execute writes.
 *                     Star brightness and star colour boost are back as
 *                     sliders, both starting at 0 so the combination and the
 *                     green removal are all that happens until they are moved.
 *                     No name appears anywhere in the interface any more. The
 *                     licence notice in this header is kept because the
 *                     licences of the works it names require it; it is a source
 *                     comment and is never shown on screen.
 * 2.6.1   2026-08-27  Fixed: linear input produced a washed-out image sitting
 *                     on a grey floor. The star frames were being solved their
 *                     own auto stretch, and a star-only frame is almost all
 *                     empty background - its median IS that background - so
 *                     putting that median on the 0.25 target lifted the void to
 *                     mid grey and drove every star past 0.92. The screen
 *                     combination cannot go below the brighter input, so the
 *                     whole image inherited the floor.
 *                     The star frames now share the nebula's midtones curve,
 *                     which keeps both on one brightness scale, but keep their
 *                     own black point, because the nebula's would subtract a
 *                     sky pedestal the star frame no longer has and clip every
 *                     faint star to zero. Measured on linear data: background
 *                     0.018, faint star 0.37, bright star 0.98.
 *                     The default star brightness is 1.00 rather than 0, and
 *                     the preview says so when the selected channels look
 *                     linear but the switch is off.
 * 2.7.0   2026-08-27  The histogram belongs to the image the preview is
 *                     showing. Each of starless, stars and the luminance layer
 *                     keeps its own black point, midtones and white point;
 *                     switching the target brings that image's markers back and
 *                     redraws the histogram from that image, and at Execute each
 *                     set is applied to its own image and to nothing else.
 *                     Fixed: one set of markers described the starless histogram
 *                     and was applied to the starless image whatever was on
 *                     screen, so adjusting them while examining the stars
 *                     quietly crushed the nebula - and because the markers are
 *                     remembered, a black point tuned on an earlier, already
 *                     stretched frame was reapplied to a fresh linear render.
 *                     That is why the stars looked right while the nebula did
 *                     not: the star set was still at its identity.
 *                     Changing a source image now resets every set and says so,
 *                     and the status line names any set that is in force but not
 *                     on screen.
 *                     The combined view is gone from the preview; the _combined
 *                     output is unaffected. A preview showing the stars no
 *                     longer builds the whole starless pipeline to throw it
 *                     away.
 * 3.0.0   2026-08-27  LINEAR INPUT SUPPORT IS REMOVED. This script now takes
 *                     NON-LINEAR (stretched) images only, and says so in the
 *                     file header, the Feature Scripts blurb and the dialog
 *                     banner. The auto stretch never worked reliably across the
 *                     range of linear data people actually have - four separate
 *                     faults were found and fixed in it over 2.3.4 to 2.6.1 and
 *                     it still did not hold up - so the honest thing is to stop
 *                     claiming it. Stretch each channel first, with whatever
 *                     you normally use, then bring it here.
 *                     Channel normalization stays: it works on stretched data
 *                     and is what brings Sii, Ha and Oiii to a common
 *                     brightness. The status line still says, in capitals, when
 *                     the selected channels look linear.
 * 3.0.1   2026-08-27  The Foraxx amount and the two transition sliders grey out
 *                     on the fixed palettes, which are straight permutations of
 *                     the channels and have no transition to shape. The amount
 *                     is held at 0 there as well, so a greyed slider can never
 *                     be hiding a value restored from a settings file or a
 *                     process icon.
 *
 ******************************************************************************
 */

/* beautify ignore:start */

#feature-id    ForaxxPaletteStudio : CaeloWorks > Foraxx Palette Studio
#feature-icon  @script_icons_dir/ForaxxPaletteStudio.svg

#feature-info  REQUIRES NON-LINEAR (STRETCHED) IMAGES - linear data is not \
supported.<br/>\
Narrowband palette construction with a live preview, per-channel weighting, \
independent star and luminance controls, a draggable histogram, and green and \
magenta suppression.

#define TITLE   "Foraxx Palette Studio"

// Stamped by scripts/build-update-package.sh at packaging time; scripts/stage-dev.sh
// writes "dev". The release tag is the single source of truth for the version -
// there is no version number to keep in step by hand.
#define VERSION "__BUILD__"

#include <pjsr/StdIcon.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdDialogCode.jsh>

#include "lib/FXParameters.js"
#include "lib/FXDialog.js"

/* beautify ignore:end */

/*
 * Reports what was produced, with the settings that produced it, so the run is
 * reproducible from the console log alone.
 */
function fxReport( created, elapsedMs )
{
   Console.noteln( "<end><cbr><br>* " + TITLE + " " + VERSION );
   Console.writeln( "Palette ............. " + fxStyle( FX ).name );
   Console.writeln( "Channels ............ " + (FX.twoChannels ? "Ha / Oiii" : "Sii / Ha / Oiii") );
   // The auto stretch changes every pixel it touches, so it belongs in the
   // record that makes a run reproducible from the log alone.
   if ( FX.linearInput )
      Console.writeln( format( "Auto stretch ........ %s, target %.3f, shadows clip %.2f sigma%s",
                                  FX.linearMethod == 1 ? "statistical stretch" : "screen transfer",
                                  FX.linearTarget, FX.linearClip,
                               FX.linearNoClip ? ", black point never clipped" : "" ) );
   if ( FX.normalizeEnabled )
      Console.writeln( format( "Normalization ....... reference %s, levels Sii %.2f Ha %.2f "
                             + "Oiii %.2f, shadow %.2f",
                               [ "Sii", "Ha", "Oiii" ][FX.normalizeRef],
                               FX.normSii, FX.normHa, FX.normOiii, FX.normShadow ) );
   Console.writeln( format( "Weights ............. Sii %.2f  Ha %.2f  Oiii %.2f",
                            FX.gainSii, FX.gainHa, FX.gainOiii ) );
   if ( fxStyle( FX ).dynamic )
   {
      Console.writeln( format( "Foraxx amount ....... %.2f", FX.blend ) );
      Console.writeln( format( "Transitions ......... Sii/Ha %s  Ha/Oiii %.2f",
                               fxStyle( FX ).needsSii ? format( "%.2f", FX.hardO ) : "n/a",
                               FX.hardHO ) );
   }
   Console.writeln( format( "Curves / saturation . %.2f / %.2f", FX.curveStrength, FX.satStrength ) );
   if ( FX.extraSaturation > 0 || FX.posterLevels > 1 )
      Console.writeln( format( "Colour .............. overall saturation %.2f, %d poster levels",
                               FX.extraSaturation, FX.posterLevels ) );
   if ( FX.makeStars )
      Console.writeln( format( "Stars ............... broadband mix%s, brightness %.2f, "
                             + "colour %.2f",
                               FX.starCleanGreen ? ", green removed" : "",
                               FX.starStretch, FX.starSaturation ) );
   if ( FX.makeLuminance )
      Console.writeln( format( "Luminance ........... CIE L*, levels %.4f / %.4f / %.4f, "
                             + "applied %.2f",
                               FX.lumLow, FX.lumMid, FX.lumHigh, FX.lumApply ) );
   if ( FX.hdrEnabled && (FX.hdrAmount > 0 || FX.hdrLayers > 0 || FX.localContrast > 0) )
      Console.writeln( format( "HDR / contrast ...... compression %.2f above %.2f, %d layers, "
                             + "local %.2f",
                               FX.hdrAmount, FX.hdrKnee, FX.hdrLayers, FX.localContrast ) );
   Console.writeln( format( "Levels, starless .... %.4f / %.4f / %.4f",
                            FX.levelsLow, FX.levelsMid, FX.levelsHigh ) );
   if ( FX.makeStars )
      Console.writeln( format( "Levels, stars ....... %.4f / %.4f / %.4f",
                               FX.starLevelsLow, FX.starLevelsMid, FX.starLevelsHigh ) );

   if ( FX.scnrEnabled && (!fxIsZero( FX.scnrGreen ) || !fxIsZero( FX.scnrMagenta )) )
      Console.writeln( format( "Colour suppression .. average neutral, green %.2f, "
                             + "magenta %.2f, lightness %s (starless only)",
                               FX.scnrGreen, FX.scnrMagenta,
                               FX.scnrPreserveL ? "preserved" : "not preserved" ) );
   else
      Console.writeln( "Colour suppression .. off" );

   Console.writeln( "" );
   if ( created.starless )
      Console.noteln( "Created: " + created.starless );
   if ( created.stars )
      Console.noteln( "Created: " + created.stars );
   if ( created.combined )
      Console.noteln( "Created: " + created.combined );
   if ( created.o )
      Console.writeln( "Created: " + created.o + " (dynamic factor)" );
   if ( created.ho )
      Console.writeln( "Created: " + created.ho + " (dynamic factor)" );
   if ( created.luminance )
      Console.noteln( "Created: " + created.luminance + " (artificial luminance)" );

   Console.writeln( format( "<br>Done in %.2f s", elapsedMs / 1000 ) );
}

function main()
{
   // Let PJSR collect the garbage this script inevitably produces.
   jsAutoGC = true;

   if ( Parameters.isViewTarget )
   {
      (new MessageBox( TITLE + " combines several images and cannot run on a single view.\n\n"
                     + "Run it from the Script menu instead.",
                       TITLE, StdIcon_Warning, StdButton_Ok )).execute();
      return;
   }

   // Saved settings first, then anything carried by a process icon.
   fxLoadSettings();
   if ( Parameters.isGlobalTarget )
      fxImportParameters();

   // Clean up anything a previous, interrupted run may have left behind.
   fxSweepTemporaries();

   // The dialog builds the images itself, so that several palettes can be
   // produced without reopening it. All this has to do is show it and tidy up.
   let dialog = new ForaxxStudioDialog;
   dialog.execute();

   // Whatever happened in there, the settings the user left behind are the
   // ones they want next time - a session spent tuning and then closed without
   // an Execute must not be thrown away.
   fxSaveSettings();
   fxSweepTemporaries();

   if ( dialog.didRun )
      Console.writeln( "<end><cbr>" + TITLE + ": closed." );
   else
      Console.writeln( "<end><cbr>" + TITLE + ": closed without building anything." );
}

main();
