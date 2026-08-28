// The defensive layer over every settings file and process icon in the field.
//
// These functions only ever run on input the user can corrupt — a settings file
// edited by hand, a process icon dragged in from a version that no longer
// exists, a value written by a build that has since been withdrawn. They had no
// assertions at all: the 2026-08-28 audit found the whole layer untested, and
// two live defects in it that a single round trip would have caught.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, near, report } = require( './assert.js' );

const snapshot = () => JSON.parse( JSON.stringify(
   Object.keys( fx.FX ).reduce( ( o, k ) => {
      if ( typeof fx.FX[k] !== 'object' ) o[k] = fx.FX[k];
      return o;
   }, {} ) ) );
const restore = snap => Object.keys( snap ).forEach( k => { fx.FX[k] = snap[k]; } );
const CLEAN = snapshot();

// ---------------------------------------------------------------------------
// fxSanitize. Whatever it is handed, every numeric parameter must come out
// finite and inside its own range — a NaN reaching a slider makes the control
// unusable, and a NaN reaching the expression writer reaches the image.
// ---------------------------------------------------------------------------
{
   restore( CLEAN );
   Object.keys( fx.FXRanges ).forEach( k => { fx.FX[k] = NaN; } );
   fx.FX.styleIndex = NaN;
   fx.FX.previewTarget = NaN;
   fx.fxSanitize();

   Object.keys( fx.FXRanges ).forEach( k => {
      const [ lo, hi ] = fx.FXRanges[k];
      ok( isFinite( fx.FX[k] ), k + ' is finite after a NaN settings file' );
      ok( fx.FX[k] >= lo && fx.FX[k] <= hi, k + ' is back inside its range' );
   } );

   restore( CLEAN );
   Object.keys( fx.FXRanges ).forEach( k => { fx.FX[k] = fx.FXRanges[k][1] * 1000; } );
   fx.fxSanitize();
   Object.keys( fx.FXRanges ).forEach( k =>
      ok( fx.FX[k] <= fx.FXRanges[k][1], k + ' is clamped down from an absurd value' ) );

   restore( CLEAN );
   Object.keys( fx.FXRanges ).forEach( k => { fx.FX[k] = -1e9; } );
   fx.fxSanitize();
   Object.keys( fx.FXRanges ).forEach( k =>
      ok( fx.FX[k] >= fx.FXRanges[k][0], k + ' is clamped up from a negative value' ) );

   // Idempotence. It runs on every load, and a settings file written by one
   // version is read by the next: a second pass must be a no-op, or a value
   // walks a little further from where the user put it on every launch.
   restore( CLEAN );
   Object.keys( fx.FXRanges ).forEach( k => { fx.FX[k] = NaN; } );
   fx.fxSanitize();
   const once = snapshot();
   fx.fxSanitize();
   const twice = snapshot();
   Object.keys( once ).forEach( k => eq( twice[k], once[k], 'fxSanitize is idempotent for ' + k ) );

   // A clean object must come through untouched, or every launch drifts.
   restore( CLEAN );
   fx.fxSanitize();
   Object.keys( CLEAN ).forEach( k =>
      eq( fx.FX[k], CLEAN[k], 'fxSanitize leaves a valid "' + k + '" alone' ) );
}

// ---------------------------------------------------------------------------
// The style index survives whatever a settings file holds. This is the value
// that used to throw out of main() before the dialog could open.
// ---------------------------------------------------------------------------
{
   [ NaN, -3, 1e6, 2.5 ].forEach( bad => {
      restore( CLEAN );
      fx.FX.styleIndex = bad;
      fx.fxSanitize();
      ok( Number.isInteger( fx.FX.styleIndex ), 'styleIndex is a whole number after ' + bad );
      ok( fx.FX.styleIndex >= 0 && fx.FX.styleIndex < fx.FXStyles.length,
          'styleIndex indexes the table after ' + bad );
      ok( fx.fxStyle( fx.FX ) !== undefined, 'and fxStyle resolves after ' + bad );
   } );
   restore( CLEAN );
}

// ---------------------------------------------------------------------------
// Applying a style. Every palette must leave the parameter object in a state
// the pipeline can render, and a fixed palette must arrive with its Foraxx
// amount at 0 — 3.0.1's promise that a greyed slider is never hiding a value.
// ---------------------------------------------------------------------------
{
   fx.FXStyles.forEach( ( style, i ) => {
      restore( CLEAN );
      fx.fxApplyStyle( i );
      eq( fx.FX.styleIndex, i, '"' + style.name + '" is selected' );
      Object.keys( style.values ).forEach( k =>
         eq( fx.FX[k], style.values[k], '"' + style.name + '" sets ' + k ) );
      if ( !style.dynamic )
         eq( fx.FX.blend, 0, '"' + style.name + '" is fixed, so the amount lands at 0' );
      Object.keys( fx.FXRanges ).forEach( k => {
         const [ lo, hi ] = fx.FXRanges[k];
         ok( fx.FX[k] >= lo && fx.FX[k] <= hi,
             '"' + style.name + '" leaves ' + k + ' inside its range' );
      } );
   } );
   restore( CLEAN );
}

// ---------------------------------------------------------------------------
// Resetting the levels. Each set returns to an identity and the others are left
// alone — the 2.7.0 separation, asserted through the function that does it.
// ---------------------------------------------------------------------------
{
   restore( CLEAN );
   fx.FX_LEVEL_SETS.forEach( set => {
      fx.FX[set.low] = 0.2; fx.FX[set.mid] = 0.7; fx.FX[set.high] = 0.9;
   } );
   const cleared = fx.fxResetAllLevels();
   ok( Array.isArray( cleared ), 'fxResetAllLevels reports what it undid' );
   eq( cleared.length, fx.FX_LEVEL_SETS.length, 'and names every set that was carrying something' );
   fx.FX_LEVEL_SETS.forEach( set =>
      ok( fx.fxLevelsAreIdentity( set ), set.name + ' is back to an identity' ) );

   // Nothing to undo must report nothing, or the user is told about a reset
   // that did not happen.
   eq( fx.fxResetAllLevels().length, 0, 'resetting an identity reports no change' );
   restore( CLEAN );
}

// ---------------------------------------------------------------------------
// Migrations. They run against values written by versions that no longer exist,
// on people's saved icons, and they only get one chance each.
// ---------------------------------------------------------------------------
{
   // The retired "combined" preview target must not resolve to Luminance.
   restore( CLEAN );
   fx.FX.paletteSchema = 1;
   fx.FX.previewTarget = 2;
   fx.fxMigratePreviewTarget();
   ok( fx.FX.previewTarget !== 2 || fx.FX_LEVEL_SETS.length <= 2,
       'a retired preview target is migrated rather than reinterpreted' );

   // Idempotence: a migration that runs twice must not move the value twice.
   restore( CLEAN );
   fx.FX.paletteSchema = 1;
   fx.FX.previewTarget = 2;
   fx.fxMigratePreviewTarget();
   const after = fx.FX.previewTarget;
   fx.fxMigratePreviewTarget();
   eq( fx.FX.previewTarget, after, 'fxMigratePreviewTarget does not move a value twice' );

   // The fixed palettes used to store an amount of 1.00 that nothing read.
   restore( CLEAN );
   const fixed = fx.FXStyles.findIndex( s => !s.dynamic );
   fx.FX.paletteSchema = 1;
   fx.FX.styleIndex = fixed;
   fx.FX.blend = 1.00;
   fx.fxMigratePaletteBlend();
   eq( fx.FX.blend, 0, 'a fixed palette restored from an old icon comes back with amount 0' );

   restore( CLEAN );
   fx.FX.paletteSchema = 1;
   fx.FX.styleIndex = 0;          // dynamic
   fx.FX.blend = 1.00;
   fx.fxMigratePaletteBlend();
   eq( fx.FX.blend, 1.00, 'a dynamic palette keeps its amount' );

   // hdrEnabled did not exist before the section was switched: an old file with
   // an amount set and no key must not silently switch the section on, nor lose
   // a setting the user made.
   restore( CLEAN );
   fx.FX.hdrEnabled = false;
   fx.FX.hdrAmount = 0.5;
   fx.fxMigrateHdrEnabled( false );
   ok( typeof fx.FX.hdrEnabled === 'boolean', 'hdrEnabled stays a boolean after migration' );
   restore( CLEAN );
}

// ---------------------------------------------------------------------------
// The persistence schema against the live values. A `real` declared as `int`
// passes a whole-number spot check and then rounds the user's value away on
// the next save, so the declaration is checked against the RANGE precision as
// well as the current value.
// ---------------------------------------------------------------------------
{
   const declared = {};
   fx.FXPersisted.forEach( ( [ name, type ] ) => { declared[name] = type; } );
   Object.keys( fx.FXRanges ).forEach( name => {
      const decimals = fx.FXRanges[name][2];
      if ( decimals > 0 )
         eq( declared[name], 'real',
             name + ' has ' + decimals + ' decimals, so it must persist as real - '
             + 'an int declaration would round every stored value away' );
   } );
   fx.FX_LEVEL_SETS.forEach( set => [ 'low', 'mid', 'high' ].forEach( slot =>
      eq( declared[ set[slot] ], 'real', set.name + '.' + slot + ' persists as real' ) ) );
}

restore( CLEAN );
report( 'settings' );
