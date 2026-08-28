// SPDX-License-Identifier: CC-BY-NC-4.0
#ifndef __FX_Parameters_js
#define __FX_Parameters_js

/*
 * *****************************************************************************
 *
 * FXParameters.js - Parameter store, palette styles and persistence.
 * Part of Foraxx Palette Studio.
 *
 * *****************************************************************************
 */

#include <pjsr/DataType.jsh>

/*
 * -----------------------------------------------------------------------------
 * Palette styles
 * -----------------------------------------------------------------------------
 *
 * One list, not two. A style says how the channels are mapped to R, G and B,
 * what every tuning parameter starts at, and what the resulting images are
 * called. Selecting one sets all of that at once; you are then free to move any
 * slider afterwards.
 *
 *   dynamic  : true uses the dynamic masks, false is a fixed mapping
 *   map      : the source of R, G and B in order. 'S' = Sii, 'H' = Ha, 'O' = Oiii
 *   needsSii : whether a Sii image is required
 *   id       : base identifier for the images produced
 *   values   : tuning parameters applied when the style is selected
 */
var FXStyles =
[
   {
      key: "styleForaxxClassic",
      name: "Foraxx - classic (starless identical to the original)",
      dynamic: true, map: "SHO", needsSii: true, id: "Foraxx",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 1.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: false, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleForaxxClean",
      name: "Foraxx - with colour clean-up",
      dynamic: true, map: "SHO", needsSii: true, id: "Foraxx",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 1.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleForaxxSoft",
      name: "Foraxx - soft transition",
      dynamic: true, map: "SHO", needsSii: true, id: "Foraxx_soft",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.75, hardO: 0.65, hardHO: 0.65,
         curveStrength: 0.80, satStrength: 0.80,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.45, scnrMagenta: 0.60
      }
   },
   {
      key: "styleForaxxGold",
      name: "Foraxx - gold forward",
      dynamic: true, map: "SHO", needsSii: true, id: "Foraxx_gold",
      values: {
         gainSii: 1.25, gainHa: 1.15, gainOiii: 0.90,
         blend: 1.00, hardO: 1.40, hardHO: 1.30,
         curveStrength: 1.00, satStrength: 1.15,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.55, scnrMagenta: 0.70
      }
   },
   {
      key: "styleForaxxTeal",
      name: "Foraxx - teal forward",
      dynamic: true, map: "SHO", needsSii: true, id: "Foraxx_teal",
      values: {
         gainSii: 0.90, gainHa: 0.95, gainOiii: 1.30,
         blend: 1.00, hardO: 0.75, hardHO: 0.70,
         curveStrength: 1.00, satStrength: 1.10,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleForaxxHOO",
      name: "Foraxx HOO - dynamic, Ha and Oiii only",
      dynamic: true, map: "HOO", needsSii: false, id: "Foraxx_HOO",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 1.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleWarhol",
      name: "Andy Warhol - poster colour",
      dynamic: true, map: "SHO", needsSii: true, id: "Warhol",
      values: {
         gainSii: 1.40, gainHa: 1.30, gainOiii: 1.40,
         blend: 1.00, hardO: 1.80, hardHO: 1.80,
         curveStrength: 1.30, satStrength: 2.00,
         extraSaturation: 2.20, posterLevels: 6,
         starCleanGreen: false,
         scnrEnabled: false, scnrGreen: 0.00, scnrMagenta: 0.00
      }
   },
   {
      key: "styleSHO",
      name: "SHO (Hubble)",
      dynamic: false, map: "SHO", needsSii: true, id: "SHO",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleHSO",
      name: "HSO",
      dynamic: false, map: "HSO", needsSii: true, id: "HSO",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleHOS",
      name: "HOS",
      dynamic: false, map: "HOS", needsSii: true, id: "HOS",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleOHS",
      name: "OHS",
      dynamic: false, map: "OHS", needsSii: true, id: "OHS",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleOSH",
      name: "OSH",
      dynamic: false, map: "OSH", needsSii: true, id: "OSH",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleSOH",
      name: "SOH",
      dynamic: false, map: "SOH", needsSii: true, id: "SOH",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleHOO",
      name: "HOO (bicolour)",
      dynamic: false, map: "HOO", needsSii: false, id: "HOO",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   },
   {
      key: "styleOHH",
      name: "OHH",
      dynamic: false, map: "OHH", needsSii: false, id: "OHH",
      values: {
         gainSii: 1.00, gainHa: 1.00, gainOiii: 1.00,
         blend: 0.00, hardO: 1.00, hardHO: 1.00,
         curveStrength: 1.00, satStrength: 1.00,
         extraSaturation: 0.00, posterLevels: 0,
         starCleanGreen: true,
         scnrEnabled: true, scnrGreen: 0.50, scnrMagenta: 0.70
      }
   }
];

function fxStyle( p )
{
   // Coerce before comparing. A NaN index satisfies neither i < 0 nor
   // i >= length, so it used to pass the guard untouched and FXStyles[NaN]
   // returned undefined; the migrations dereference the result before
   // fxSanitize runs, so one corrupt settings file threw out of main() and the
   // dialog then failed to open on every subsequent launch as well.
   let i = Math.floor( Number( p.styleIndex ) );
   if ( !isFinite( i ) || i < 0 || i >= FXStyles.length )
      i = 0;
   return FXStyles[i];
}

/*
 * First style in the list that works with the number of channels available.
 */
function fxFirstStyleFor( twoChannels )
{
   for ( let i = 0; i < FXStyles.length; ++i )
      if ( FXStyles[i].needsSii != twoChannels )
         return i;
   return 0;
}

/*
 * The single global parameter object. Everything the dialog edits and
 * everything the renderer reads lives here, so preview and final render can
 * never drift apart.
 */
var FX =
{
   // ---- input views (View objects, resolved at run time) --------------------
   siiView:        null,
   haView:         null,
   oiiiView:       null,
   siiStarsView:   null,
   haStarsView:    null,
   oiiiStarsView:  null,

   // ---- data layout --------------------------------------------------------
   styleIndex:     0,       // index into FXStyles
   twoChannels:    false,   // what data you have; a style needing Sii forces 3
   makeStars:      true,    // build a separate stars image

   // ---- channel normalization (narrowband normalization style) --------------
   normalizeEnabled: false,
   normalizeRef:   1,       // reference channel: 0 = Sii, 1 = Ha, 2 = Oiii
   normSii:        1.00,    // target median as a multiple of the reference's
   normHa:         1.00,
   normOiii:       1.00,
   normShadow:     0.25,    // black point, interpolated from minimum to median

   // ---- linear input -------------------------------------------------------
   //
   // Withdrawn in 3.0.0 and restored here. What broke it then is fixed now: the
   // midtones floor is 1e-8 rather than 0.001 and fxNum emits twelve decimals
   // below 1e-4, so a balance of 2.5e-5 survives being written into an
   // expression; star frames share the nebula's curve instead of solving their
   // own; and the target composes with Channel normalization rather than being
   // replaced by it, which is what made the two together 250x darker than
   // either alone.
   linearInput:    false,   // sources are still linear; auto-stretch them first
   linearMethod:   1,       // 0 = STF, 1 = statistical stretch (SetiAstro)
   linearTarget:   0.25,    // target background / median of the stretch
   linearClip:     2.80,    // shadows clipping, in MAD sigmas
   linearNoClip:   false,   // never place the black point above the darkest pixel


   // ---- channel weighting (soft gain, 1.0 = untouched) ---------------------
   gainSii:        1.00,
   gainHa:         1.00,
   gainOiii:       1.00,

   // ---- Foraxx dynamic blend ----------------------------------------------
   blend:          1.00,    // 0 = the static map, 1 = full Foraxx
   hardO:          1.00,    // exponent multiplier of the 'o'  mask
   hardHO:         1.00,    // exponent multiplier of the 'ho' mask

   // ---- tone and colour, starless -----------------------------------------
   curveStrength:  1.00,    // scales the two signature hue curves
   satStrength:    1.00,    // scales the saturation curve + selective boost
   extraSaturation: 0.00,   // flat saturation boost across every hue
   posterLevels:   0,       // 0 = off, otherwise quantise to this many levels

   // ---- stars, independent of the starless image ---------------------------
   // The finishing chain below is shared by both combinations.
   starCleanGreen: true,    // the SCNR / mtf / SCNR / reverse-mtf pass
   starStretch:    1.00,    // hyperbolic star brightening, on the stretched star
                            // frames this script requires.
   starSaturation: 0.00,    // hue-weighted colour boost, 0 = leave the colour alone


   // ---- green / magenta suppression ---------------------------------------
   scnrEnabled:      true,
   scnrGreen:        0.50,
   scnrMagenta:      0.70,
   scnrPreserveL:    true,

   // ---- HDR and local contrast (starless) ----------------------------------
   hdrEnabled:     false,   // the whole HDR / local contrast stage, off by default
   hdrAmount:      0.00,    // highlight compression above the knee, 0 = off
   hdrKnee:        0.60,    // where the compression *starts* - a position, not
                            // an amount, so it has no meaningful zero. Nothing
                            // happens at any knee while hdrAmount is 0.
   hdrLayers:      0,       // HDRMultiscaleTransform layers, 0 = off
   localContrast:  0.00,    // large scale unsharp mask amount, 0 = off

   // ---- artificial luminance ----------------------------------------------
   makeLuminance:  false,
   lumApply:       0.00,    // 0 = only produce the layer, 1 = fully substitute it
   lumLow:         0.00,    // black point of the extracted layer
   lumMid:         0.50,    // midtones balance - the stretch amount
   lumHigh:        1.00,    // white point

   // ---- levels (starless) --------------------------------------------------
   // One set of levels per previewable image. The histogram edits whichever
   // set belongs to the image on screen, and each set is applied only to its
   // own image - the starless levels never touch the stars, and vice versa.
   levelsLow:      0.00,    // starless: black point
   levelsMid:      0.50,    // starless: midtones balance (MTF m parameter)
   levelsHigh:     1.00,    // starless: white point
   starLevelsLow:  0.00,    // stars: black point
   starLevelsMid:  0.50,    // stars: midtones balance
   starLevelsHigh: 1.00,    // stars: white point

   // ---- output -------------------------------------------------------------
   baseId:         "Foraxx",
   makeCombined:   false,   // screen-combine starless + stars
   makeFactors:    false,   // keep the 'o' and 'ho' mask images

   // ---- preview ------------------------------------------------------------
   autoPreview:    true,
   // The interface language, "en" or "fr". Not the language of the console
   // report or of the image identifiers: those are what you paste into a forum
   // post, and translating them would make two users' logs incomparable.
   lang:           "en",

   paletteSchema:  1,       // bumped when a stored value changes meaning. A file
                            // written before 2.5.0 has no such key, so it loads
                            // as 1 and the migration below runs exactly once.
   previewFit:     true,    // fit the image to the panel; the wheel leaves this
   previewScale:   1.00,    // continuous display scale when not fitting. A pure
                            // display transform - it never re-renders. Named
                            // apart from the old previewZoom step index so a
                            // settings file from 2.3.1 cannot be misread as one.
   previewDetail:  0,       // render sampling: 0 = auto, 1 = 1:1, 2 = 1:2, 3 = 1:4, 4 = 1:8
   previewTarget:  0,       // 0 = starless, 1 = stars, 2 = artificial luminance

   // ---- layout -------------------------------------------------------------
   sideBarWidth:   560,     // logical pixels; dragged with the vertical splitter
   histogramHeight: 220     // logical pixels; dragged with the horizontal splitter
};

/*
 * Factory defaults of every scalar, captured before anything can change them.
 * This is what the little reset button in front of each slider restores.
 */
/*
 * Every levels set, in one place, so they can be reset together when the source
 * images change. Levels are tuning for one particular set of images: carrying
 * a black point from last week's already-stretched frames onto a fresh linear
 * render is what makes the nebula come out crushed while the stars - whose set
 * is still at its identity - look fine.
 */
// name is for the log and for anything that reads a set by hand; nameKey is what
// the interface shows. The two are separate because the console is deliberately
// not translated - a log has to be comparable between users - while a sentence
// on screen that ends in a list of English words is just a sentence half done.
var FX_LEVEL_SETS = [
   { name: "starless",  nameKey: "setStarless", titleKey: "levelsStarless",
     low: "levelsLow",     mid: "levelsMid",     high: "levelsHigh" },
   { name: "stars",     nameKey: "setStars",    titleKey: "levelsStars",
     low: "starLevelsLow", mid: "starLevelsMid", high: "starLevelsHigh" },
   { name: "luminance", nameKey: "setLum",      titleKey: "levelsLum",
     low: "lumLow",        mid: "lumMid",        high: "lumHigh" }
];

function fxLevelsAreIdentity( set )
{
   return FX[set.low] < 0.0005 && FX[set.high] > 0.9995
       && Math.abs( FX[set.mid] - 0.5 ) < 0.0005;
}

/*
 * Puts every set back to an identity. Returns the names of the sets that were
 * actually carrying something, so the caller can say what it just undid.
 */
function fxResetAllLevels()
{
   let cleared = [];
   for ( let i = 0; i < FX_LEVEL_SETS.length; ++i )
   {
      let set = FX_LEVEL_SETS[i];
      if ( !fxLevelsAreIdentity( set ) )
         cleared.push( set.nameKey );
      FX[set.low] = FXDefaults[set.low];
      FX[set.mid] = FXDefaults[set.mid];
      FX[set.high] = FXDefaults[set.high];
   }
   return cleared;
}

/*
 * The sets that are carrying something but are not the one on screen. Nothing
 * else would tell the user that a black point they cannot see is still in force
 * on the image they are about to build.
 */
function fxLevelsInForceElsewhere( shownIndex )
{
   let names = [];
   for ( let i = 0; i < FX_LEVEL_SETS.length; ++i )
      if ( i != shownIndex && !fxLevelsAreIdentity( FX_LEVEL_SETS[i] ) )
         names.push( FX_LEVEL_SETS[i].nameKey );
   return names;
}

var FXDefaults = {};
(function()
{
   for ( let key in FX )
      if ( key.indexOf( "View" ) < 0 )
         FXDefaults[key] = FX[key];
})();

function fxDefaultOf( name )
{
   return FXDefaults[name];
}

/*
 * Applies a style: the mapping, every tuning value it names, and its output
 * identifier. Anything the style does not mention is left alone.
 */
function fxApplyStyle( index )
{
   if ( index < 0 || index >= FXStyles.length )
      return;
   let s = FXStyles[index];
   FX.styleIndex = index;
   for ( let key in s.values )
      FX[key] = s.values[key];
   FX.baseId = s.id;
   fxSyncStyle();
}

/*
 * Keeps the channel count and the style consistent with each other. A style
 * that needs Sii forces three channels; choosing two channels moves to the
 * first style that works without Sii.
 */
function fxSyncStyle()
{
   if ( fxStyle( FX ).needsSii )
      FX.twoChannels = false;
}

function fxSetChannelCount( twoChannels )
{
   FX.twoChannels = twoChannels;
   if ( twoChannels && fxStyle( FX ).needsSii )
   {
      // The style needs Sii and we no longer have it, so move to the first one
      // that does not. A stock output name follows the style; a name the user
      // typed themselves is theirs to keep.
      let previousStockId = fxStyle( FX ).id;
      let keepId = FX.baseId;
      fxApplyStyle( fxFirstStyleFor( true ) );
      if ( keepId.length > 0 && keepId != previousStockId )
         FX.baseId = keepId;
   }
}

/*
 * -----------------------------------------------------------------------------
 * Persistence
 * -----------------------------------------------------------------------------
 */

var FXPersisted =
[
   [ "styleIndex",       "int"     ],
   [ "twoChannels",      "boolean" ],
   [ "makeStars",        "boolean" ],
   [ "normalizeEnabled",  "boolean" ],
   [ "normalizeRef",      "int"     ],
   [ "normSii",           "real"    ],
   [ "normHa",            "real"    ],
   [ "normOiii",          "real"    ],
   [ "normShadow",        "real"    ],
   [ "gainSii",          "real"    ],
   [ "gainHa",           "real"    ],
   [ "gainOiii",         "real"    ],
   [ "blend",            "real"    ],
   [ "hardO",            "real"    ],
   [ "hardHO",           "real"    ],
   [ "curveStrength",    "real"    ],
   [ "satStrength",      "real"    ],
   [ "extraSaturation",  "real"    ],
   [ "posterLevels",     "int"     ],
   [ "starCleanGreen",   "boolean" ],
   [ "starStretch",      "real"    ],
   [ "starSaturation",   "real"    ],
   [ "scnrEnabled",      "boolean" ],
   [ "scnrGreen",        "real"    ],
   [ "scnrMagenta",      "real"    ],
   [ "scnrPreserveL",    "boolean" ],
   [ "hdrEnabled",       "boolean" ],
   [ "hdrAmount",        "real"    ],
   [ "hdrKnee",          "real"    ],
   [ "hdrLayers",        "int"     ],
   [ "localContrast",    "real"    ],
   [ "makeLuminance",    "boolean" ],
   [ "lumApply",         "real"    ],
   [ "lumLow",           "real"    ],
   [ "lumMid",           "real"    ],
   [ "lumHigh",          "real"    ],
   [ "levelsLow",        "real"    ],
   [ "levelsMid",        "real"    ],
   [ "levelsHigh",       "real"    ],
   [ "starLevelsLow",    "real"    ],
   [ "starLevelsMid",    "real"    ],
   [ "starLevelsHigh",   "real"    ],
   [ "baseId",           "string"  ],
   [ "makeCombined",     "boolean" ],
   [ "makeFactors",      "boolean" ],
   [ "autoPreview",      "boolean" ],
   [ "paletteSchema",    "int"     ],
   [ "lang",             "string"  ],
   [ "linearInput",      "boolean" ],
   [ "linearMethod",     "int"     ],
   [ "linearTarget",     "real"    ],
   [ "linearClip",       "real"    ],
   [ "linearNoClip",     "boolean" ],
   [ "previewFit",       "boolean" ],
   [ "previewScale",     "real"    ],
   [ "previewDetail",    "int"     ],
   [ "previewTarget",    "int"     ],
   [ "sideBarWidth",     "int"     ],
   [ "histogramHeight",  "int"     ]
];

/*
 * Slider ranges, shared by the dialog and by fxSanitize so the two can never
 * disagree. [ low, high, precision ].
 */
var FXRanges =
{
   normSii:         [ 0.20, 3.00, 2 ],
   normHa:          [ 0.20, 3.00, 2 ],
   normOiii:        [ 0.20, 3.00, 2 ],
   normShadow:      [ 0.00, 1.00, 2 ],
   linearTarget:    [ 0.02, 0.60, 3 ],
   linearClip:      [ 0.00, 6.00, 2 ],
   gainSii:         [ 0.20, 3.00, 2 ],
   gainHa:          [ 0.20, 3.00, 2 ],
   gainOiii:        [ 0.20, 3.00, 2 ],
   blend:           [ 0.00, 1.00, 2 ],
   starStretch:     [ 0.00, 8.00, 2 ],
   starSaturation:  [ 0.00, 3.00, 2 ],
   lumLow:          [ 0.00, 1.00, 4 ],
   lumMid:          [ 0.001, 0.999, 4 ],
   lumHigh:         [ 0.00, 1.00, 4 ],
   hardO:           [ 0.05, 4.00, 2 ],
   hardHO:          [ 0.05, 4.00, 2 ],
   curveStrength:   [ 0.00, 2.00, 2 ],
   satStrength:     [ 0.00, 2.00, 2 ],
   extraSaturation: [ 0.00, 3.00, 2 ],
   posterLevels:    [ 0.00, 16.0, 0 ],
   scnrGreen:       [ 0.00, 1.00, 2 ],
   scnrMagenta:     [ 0.00, 1.00, 2 ],
   hdrAmount:       [ 0.00, 1.00, 2 ],
   hdrKnee:         [ 0.10, 0.99, 2 ],
   hdrLayers:       [ 0.00, 8.00, 0 ],
   localContrast:   [ 0.00, 1.00, 2 ],
   lumApply:        [ 0.00, 1.00, 2 ],
   levelsLow:       [ 0.00, 1.00, 4 ],
   levelsMid:       [ 0.001, 0.999, 4 ],
   levelsHigh:      [ 0.00, 1.00, 4 ],
   starLevelsLow:   [ 0.00, 1.00, 4 ],
   starLevelsMid:   [ 0.001, 0.999, 4 ],
   starLevelsHigh:  [ 0.00, 1.00, 4 ]
};

#define FX_SETTINGS_KEY "ForaxxPaletteStudio/"

/*
 * Stored settings and process icons can outlive a version of this script, and
 * an out-of-range value would throw when pushed into a control. Every restore
 * path ends here.
 */
function fxSanitize()
{
   function clampInt( v, lo, hi, fallback )
   {
      if ( typeof v != "number" || !isFinite( v ) )
         return fallback;
      v = Math.round( v );
      if ( v < lo ) return lo;
      if ( v > hi ) return hi;
      return v;
   }

   // An unknown style falls back to Foraxx rather than clamping to whatever
   // happens to sit at the end of the list.
   if ( typeof FX.styleIndex != "number" || !isFinite( FX.styleIndex )
     || FX.styleIndex < 0 || FX.styleIndex >= FXStyles.length )
      FX.styleIndex = 0;
   else
      FX.styleIndex = Math.round( FX.styleIndex );

   // Settings written by 2.3.1 and earlier hold a step index here, not a scale.
   // Anything at or below the old maximum index of 5 that is not a plausible
   // zoom is dropped rather than reinstated as a 5x view.
   if ( !isFinite( FX.previewScale ) || FX.previewScale <= 0 )
      FX.previewScale = 1;
   FX.previewScale = Math.min( 10, Math.max( 0.1, FX.previewScale ) );
   FX.previewDetail   = clampInt( FX.previewDetail,   0, 4, 0 );
   FX.previewTarget   = clampInt( FX.previewTarget,   0, 2, 0 );
   FX.normalizeRef    = clampInt( FX.normalizeRef,    0, 2, 1 );
   FX.linearMethod    = clampInt( FX.linearMethod,    0, 1, 1 );
   // A settings file can hold any string at all. An unknown language would make
   // every lookup fall through to English anyway, but storing it back would
   // keep the bad value alive across sessions.
   if ( FX.lang != "en" && FX.lang != "fr" )
      FX.lang = "en";
   // The floors are the natural minimums of the two panels: below 400 the
   // sliders truncate, and below 200 the levels group clips its own buttons.
   FX.sideBarWidth    = clampInt( FX.sideBarWidth,    400, 1400, 560 );
   FX.histogramHeight = clampInt( FX.histogramHeight, 200,  600, 220 );

   for ( let name in FXRanges )
   {
      let lo = FXRanges[name][0];
      let hi = FXRanges[name][1];
      let v = FX[name];
      if ( typeof v != "number" || !isFinite( v ) )
         FX[name] = FXDefaults[name];
      else
         FX[name] = (v < lo) ? lo : ((v > hi) ? hi : v);
   }
   FX.hdrLayers = Math.round( FX.hdrLayers );
   FX.posterLevels = Math.round( FX.posterLevels );
   if ( FX.posterLevels == 1 )
      FX.posterLevels = 2;   // one level is not a picture

   // The white point must stay above the black point or the transform is
   // undefined; reset rather than reject.
   if ( FX.levelsHigh <= FX.levelsLow + 0.001 )
   {
      FX.levelsLow = FXDefaults.levelsLow;
      FX.levelsHigh = FXDefaults.levelsHigh;
   }
   if ( FX.lumHigh <= FX.lumLow + 0.001 )
   {
      FX.lumLow = FXDefaults.lumLow;
      FX.lumHigh = FXDefaults.lumHigh;
   }
   if ( FX.starLevelsHigh <= FX.starLevelsLow + 0.001 )
   {
      FX.starLevelsLow = FXDefaults.starLevelsLow;
      FX.starLevelsHigh = FXDefaults.starLevelsHigh;
   }

   // A fixed mapping has no transition to interpolate, and its three transition
   // sliders are greyed out. Holding the amount at 0 here is what stops a
   // greyed slider hiding a live value - a settings file or a process icon
   // could otherwise restore a non-zero blend that the user can neither see
   // nor reach.
   if ( !fxStyle( FX ).dynamic )
      FX.blend = 0;

   if ( typeof FX.baseId != "string" || !(/^[A-Za-z_][A-Za-z0-9_]*$/).test( FX.baseId ) )
      FX.baseId = fxStyle( FX ).id;

   fxSyncStyle();
}

/*
 * Settings and process icons written before 2.3.3 carry no hdrEnabled key, but
 * may well carry non-zero HDR amounts that used to run unconditionally. Left
 * alone they would restore the sliders and silently drop the stage, changing
 * the image with nothing said anywhere - the console report is gated on the
 * same flag. So when the key was genuinely absent, adopt whatever the old
 * amounts imply.
 */
function fxMigrateHdrEnabled( sawKey )
{
   if ( sawKey )
      return;
   FX.hdrEnabled = FX.hdrAmount > 0 || FX.hdrLayers >= 1 || FX.localContrast > 0;
}

/*
 * Before 2.5.0 the fixed palettes ignored the Foraxx amount entirely, and every
 * one of them stored 1.00. Now that the amount is live on every palette,
 * restoring that verbatim would turn a plain SHO into a full dynamic Foraxx
 * without the user having touched anything.
 */
function fxMigratePaletteBlend()
{
   if ( FX.paletteSchema >= 2 )
      return;
   if ( !fxStyle( FX ).dynamic )
      FX.blend = 0;
   FX.paletteSchema = 2;
}

/*
 * Before this version the preview had four targets, with 2 = combined. The
 * combined view is gone, so a stored 3 is the luminance and a stored 2 is a
 * viewer who has nowhere to land - starless is the sane place. Has to run
 * before fxSanitize, or the clamp collapses 3 onto 2 and the two are no longer
 * distinguishable.
 */
function fxMigratePreviewTarget()
{
   if ( FX.paletteSchema >= 3 )
      return;
   if ( FX.previewTarget == 3 )
      FX.previewTarget = 2;
   else if ( FX.previewTarget == 2 )
      FX.previewTarget = 0;
   FX.paletteSchema = 3;
}

function fxLoadSettings()
{
   let sawHdrEnabled = false;

   for ( let i = 0; i < FXPersisted.length; ++i )
   {
      let name = FXPersisted[i][0];
      let type = FXPersisted[i][1];
      let value = null;
      try
      {
         switch ( type )
         {
         case "boolean":
            value = Settings.read( FX_SETTINGS_KEY + name, DataType_Boolean );
            break;
         case "int":
            value = Settings.read( FX_SETTINGS_KEY + name, DataType_Int32 );
            break;
         case "string":
            value = Settings.read( FX_SETTINGS_KEY + name, DataType_String );
            break;
         default:
            value = Settings.read( FX_SETTINGS_KEY + name, DataType_Double );
            break;
         }
      }
      catch ( x )
      {
         value = null;
      }
      if ( Settings.lastReadOK && value != null )
      {
         FX[name] = value;
         if ( name == "hdrEnabled" )
            sawHdrEnabled = true;
      }
   }
   fxMigrateHdrEnabled( sawHdrEnabled );
   fxMigratePaletteBlend();
   fxMigratePreviewTarget();
   fxSanitize();
}

function fxSaveSettings()
{
   for ( let i = 0; i < FXPersisted.length; ++i )
   {
      let name = FXPersisted[i][0];
      let type = FXPersisted[i][1];
      try
      {
         switch ( type )
         {
         case "boolean":
            Settings.write( FX_SETTINGS_KEY + name, DataType_Boolean, FX[name] );
            break;
         case "int":
            Settings.write( FX_SETTINGS_KEY + name, DataType_Int32, Math.round( FX[name] ) );
            break;
         case "string":
            Settings.write( FX_SETTINGS_KEY + name, DataType_String, FX[name] );
            break;
         default:
            Settings.write( FX_SETTINGS_KEY + name, DataType_Double, FX[name] );
            break;
         }
      }
      catch ( x )
      {
         // A failed settings write must never abort the script.
      }
   }
}

function fxExportParameters()
{
   for ( let i = 0; i < FXPersisted.length; ++i )
      Parameters.set( FXPersisted[i][0], FX[FXPersisted[i][0]] );
}

function fxImportParameters()
{
   // The icon carries its own schema, or predates the concept. Either way it
   // must be the one the migrations below judge, not the one fxLoadSettings
   // just advanced while reading a modern settings file: main() loads settings
   // first, so every schema-gated migration returned at its own first line and
   // the whole mechanism was dead on this path. A pre-2.5.0 icon is schema 1.
   FX.paletteSchema = Parameters.has( "paletteSchema" )
                    ? Parameters.getInteger( "paletteSchema" ) : 1;

   for ( let i = 0; i < FXPersisted.length; ++i )
   {
      let name = FXPersisted[i][0];
      let type = FXPersisted[i][1];
      if ( !Parameters.has( name ) )
         continue;
      switch ( type )
      {
      case "boolean":
         FX[name] = Parameters.getBoolean( name );
         break;
      case "int":
         FX[name] = Parameters.getInteger( name );
         break;
      case "string":
         FX[name] = Parameters.getString( name );
         break;
      default:
         FX[name] = Parameters.getReal( name );
         break;
      }
   }
   fxMigrateHdrEnabled( Parameters.has( "hdrEnabled" ) );
   fxMigratePaletteBlend();
   fxMigratePreviewTarget();
   fxSanitize();
}

#endif   // __FX_Parameters_js
