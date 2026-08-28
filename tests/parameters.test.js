// The parameter surface — the contract between the dialog, the settings file
// and the process icons people have already saved. A key that drifts out of one
// of these tables does not crash; it silently stops persisting, or restores a
// value nothing reads. Both are invisible until a user complains.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, near, report } = require( './assert.js' );

const KEYS = Object.keys( fx.FX );

// ---------------------------------------------------------------------------
// Persistence. Every persisted name must be a real parameter, and every type
// must be one the reader understands.
// ---------------------------------------------------------------------------
{
   const TYPES = [ 'int', 'real', 'boolean', 'string' ];
   const seen = {};
   fx.FXPersisted.forEach( entry => {
      const [ name, type ] = entry;
      ok( KEYS.indexOf( name ) >= 0, 'persisted "' + name + '" is a real parameter' );
      ok( TYPES.indexOf( type ) >= 0, 'persisted "' + name + '" has a known type: ' + type );
      ok( !seen[name], 'persisted "' + name + '" is listed once' );
      seen[name] = true;

      const v = fx.FX[name];
      if ( type === 'boolean' )
         ok( typeof v === 'boolean', name + ' is stored as boolean and is one' );
      else if ( type === 'int' || type === 'real' )
         ok( typeof v === 'number', name + ' is stored as a number and is one' );
      else if ( type === 'string' )
         ok( typeof v === 'string', name + ' is stored as a string and is one' );

      if ( type === 'int' )
         eq( v, Math.round( v ), name + ' is stored as int and holds a whole number' );
   } );

   // Anything the user can change and that changes the output has to survive a
   // restart. View selections deliberately do not - they name images that will
   // not be there next session.
   const TRANSIENT = /View$/;
   KEYS.filter( k => !TRANSIENT.test( k ) ).forEach( k => {
      if ( typeof fx.FX[k] === 'object' && fx.FX[k] !== null ) return;
      ok( seen[k], 'parameter "' + k + '" is persisted, or is deliberately transient' );
   } );
}

// ---------------------------------------------------------------------------
// Ranges. A slider whose range excludes its own default opens showing a value
// it cannot return to.
// ---------------------------------------------------------------------------
{
   Object.keys( fx.FXRanges ).forEach( name => {
      const [ lo, hi, decimals ] = fx.FXRanges[name];
      ok( KEYS.indexOf( name ) >= 0, 'range "' + name + '" is a real parameter' );
      ok( lo < hi, name + ' has a non-empty range' );
      ok( Number.isInteger( decimals ) && decimals >= 0 && decimals <= 6,
          name + ' declares a sane number of decimals' );

      const v = fx.FX[name];
      ok( v >= lo && v <= hi,
          name + ' default (' + v + ') sits inside its range [' + lo + ', ' + hi + ']' );

      // A default has to be representable at the slider's own precision, or the
      // control rounds it on the first repaint and the value drifts by itself.
      const step = Math.pow( 10, -decimals );
      near( Math.round( v / step ) * step, v,
            name + ' default is representable at ' + decimals + ' decimals', step / 100 );
   } );
}

// ---------------------------------------------------------------------------
// Defaults. FXDefaults is the snapshot the per-slider reset buttons restore.
// ---------------------------------------------------------------------------
{
   const defaults = Object.keys( fx.FXDefaults );
   ok( defaults.length > 0, 'the defaults snapshot is populated' );
   defaults.forEach( k => ok( KEYS.indexOf( k ) >= 0, 'default "' + k + '" is a real parameter' ) );
   Object.keys( fx.FXRanges ).forEach( k =>
      ok( fx.FXDefaults[k] !== undefined, 'every ranged control "' + k + '" has a reset value' ) );
}

// ---------------------------------------------------------------------------
// Level sets. Three independent sets - starless, stars, luminance - each with
// its own black point, midtones and white point. The 2.7.0 bug was one set
// being applied to an image it did not describe, so the separation is checked.
// ---------------------------------------------------------------------------
{
   eq( fx.FX_LEVEL_SETS.length, 3, 'there are three level sets' );
   const names = fx.FX_LEVEL_SETS.map( s => s.name );
   [ 'starless', 'stars', 'luminance' ].forEach( n =>
      ok( names.indexOf( n ) >= 0, 'there is a level set for the ' + n + ' image' ) );

   const used = {};
   fx.FX_LEVEL_SETS.forEach( set => {
      [ 'low', 'mid', 'high' ].forEach( slot => {
         const key = set[slot];
         ok( KEYS.indexOf( key ) >= 0, set.name + '.' + slot + ' ("' + key + '") is a real parameter' );
         ok( !used[key], set.name + '.' + slot + ' is not shared with another set' );
         used[key] = true;
      } );
      ok( fx.FX[set.low] < fx.FX[set.high], set.name + ' starts with black below white' );
      near( fx.FX[set.mid], 0.5, set.name + ' starts at a neutral midtone', 1e-9 );
   } );

   ok( fx.FX_LEVEL_SETS.every( fx.fxLevelsAreIdentity ),
       'every set starts as an identity, so a fresh run transforms nothing' );
}

// ---------------------------------------------------------------------------
// The style table. The dialog indexes into it and settings files store the
// index, so a reordering silently repoints everyone's saved palette.
// ---------------------------------------------------------------------------
{
   const names = {}, ids = {}, keys = {};
   fx.FXStyles.forEach( ( s, i ) => {
      ok( typeof s.name === 'string' && s.name.length > 0, 'style ' + i + ' has a name' );
      ok( !names[s.name], 'style name "' + s.name + '" is unique' );
      names[s.name] = true;

      ok( /^[SHO]{3}$/.test( s.map ), 'style ' + i + ' maps three channels: ' + s.map );
      eq( s.needsSii, s.map.indexOf( 'S' ) >= 0,
          '"' + s.name + '" declares needsSii to match its own mapping' );

      ok( typeof s.id === 'string' && s.id.length > 0, '"' + s.name + '" carries an output name' );
      ok( /^[A-Za-z][A-Za-z0-9_]*$/.test( s.id ),
          '"' + s.name + '" output name is a valid PixInsight identifier: ' + s.id );
      ids[s.id] = true;

      // The display name comes from the string table under this key. It is
      // deliberately not the array index: settings store the index, and keying
      // the translation on it too would mean a reordering silently relabels
      // every palette as well as repointing it.
      ok( typeof s.key === 'string' && /^style[A-Za-z]+$/.test( s.key ),
          '"' + s.name + '" carries a translation key: ' + s.key );
      ok( !keys[s.key], 'translation key "' + s.key + '" is unique' );
      keys[s.key] = true;

      ok( typeof s.values === 'object' && s.values !== null, '"' + s.name + '" carries a value set' );
      Object.keys( s.values ).forEach( k =>
         ok( KEYS.indexOf( k ) >= 0, '"' + s.name + '" sets a real parameter: ' + k ) );
   } );

   // 3.0.1: the fixed palettes hold the Foraxx amount at 0, so a greyed slider
   // can never hide a value restored from a settings file or a process icon.
   fx.FXStyles.forEach( s => {
      if ( s.dynamic ) return;
      eq( s.values.blend, 0, '"' + s.name + '" is fixed, so its Foraxx amount is held at 0' );
   } );
   ok( fx.FXStyles.some( s => s.dynamic ), 'at least one style is dynamic' );
   ok( fx.FXStyles.some( s => !s.dynamic ), 'at least one style is a fixed mapping' );

   // Both channel counts must be reachable, whatever the list order becomes.
   ok( fx.FXStyles.some( s => s.needsSii ), 'a three-channel style exists' );
   ok( fx.FXStyles.some( s => !s.needsSii ), 'a two-channel style exists' );
   ok( !fx.FXStyles[ fx.fxFirstStyleFor( true ) ].needsSii,
       'fxFirstStyleFor(two channels) lands on a style that needs no Sii' );
   ok( fx.FXStyles[ fx.fxFirstStyleFor( false ) ].needsSii,
       'fxFirstStyleFor(three channels) lands on a style that uses Sii' );

   eq( fx.fxStyle( { styleIndex: 0 } ), fx.FXStyles[0], 'fxStyle indexes the table' );
   eq( fx.fxStyle( { styleIndex: -1 } ), fx.FXStyles[0], 'a negative index falls back to the first' );
   eq( fx.fxStyle( { styleIndex: 9999 } ), fx.FXStyles[0], 'an out-of-range index falls back too' );

   // A settings file or a process icon is user-writable and can hold anything.
   // NaN satisfies neither i < 0 nor i >= length, so it used to pass the range
   // guard untouched and return undefined; the migrations dereference that
   // before fxSanitize can clean it, so main() threw and the dialog then failed
   // to open on every subsequent launch too. There is no recovery from inside
   // the script, which is what made a Medium worth a regression test.
   [ NaN, null, undefined, 7.5, -0.5, 'three', {}, [], Infinity, -Infinity ].forEach( bad => {
      const style = fx.fxStyle( { styleIndex: bad } );
      ok( style !== undefined && style !== null,
          'fxStyle survives a corrupt styleIndex of ' + JSON.stringify( bad ) );
      ok( fx.FXStyles.indexOf( style ) >= 0,
          'and returns a real style for ' + JSON.stringify( bad ) );
   } );
   eq( fx.fxStyle( { styleIndex: 7.5 } ), fx.FXStyles[7],
       'a fractional index truncates to the style it names' );
   eq( fx.fxStyle( { styleIndex: '3' } ), fx.FXStyles[3],
       'a numeric string - what a settings file round-trip can produce - still indexes' );
}

// ---------------------------------------------------------------------------
// Defaults that the README states outright.
// ---------------------------------------------------------------------------
{
   eq( fx.FX.styleIndex, 0, 'the script opens on Foraxx classic' );
   eq( fx.FX.blend, 1.00, 'the Foraxx amount starts at full' );
   eq( fx.FX.gainSii, 1.00, 'Sii weight starts neutral' );
   eq( fx.FX.gainHa, 1.00, 'Ha weight starts neutral' );
   eq( fx.FX.gainOiii, 1.00, 'Oiii weight starts neutral' );
   eq( fx.FX.hdrEnabled, false, 'the HDR section is off by default' );
   eq( fx.FX.posterLevels, 0, 'posterisation is off by default' );
}

report( 'parameters' );
