// The interface, in both languages.
//
// A translation table rots in a particular way: someone adds a control, gives
// it an English string, and the French side silently keeps rendering a key or
// falling back to English. Nothing on screen says so, and nobody who reads the
// English notices. These assertions are the only thing that will.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, report } = require( './assert.js' );

const LANGS = Object.keys( fx.FX_UI );
const EN = fx.FX_UI.en;

// ---------------------------------------------------------------------------
// Both tables carry exactly the same keys. Neither direction is harmless: a key
// missing from French renders English in a French dialog, and a key present
// only in French is a string nobody will ever see.
// ---------------------------------------------------------------------------
{
   ok( LANGS.indexOf( 'en' ) >= 0, 'there is an English table' );
   ok( LANGS.indexOf( 'fr' ) >= 0, 'there is a French table' );
   ok( Object.keys( EN ).length > 0, 'the English table is not empty' );

   LANGS.filter( l => l !== 'en' ).forEach( lang => {
      const t = fx.FX_UI[lang];
      Object.keys( EN ).forEach( k =>
         ok( t[k] !== undefined, '"' + k + '" is translated into ' + lang ) );
      Object.keys( t ).forEach( k =>
         ok( EN[k] !== undefined, '"' + k + '" exists in English too (' + lang + ' has it)' ) );
   } );
}

// ---------------------------------------------------------------------------
// Every value is a non-empty string. An empty one renders as a blank label,
// which reads as a layout bug rather than a missing translation.
// ---------------------------------------------------------------------------
LANGS.forEach( lang => {
   const t = fx.FX_UI[lang];
   Object.keys( t ).forEach( k => {
      ok( typeof t[k] === 'string', lang + '.' + k + ' is a string' );
      ok( t[k].trim().length > 0, lang + '.' + k + ' is not empty' );
   } );
} );

// ---------------------------------------------------------------------------
// The markup has to match. PixInsight renders a subset of HTML in tooltips, so
// a <p> dropped in translation costs that language its paragraph breaks and a
// stray unclosed tag can swallow the rest of the tooltip.
// ---------------------------------------------------------------------------
{
   const tags = s => ( s.match( /<\/?[a-z][a-z0-9]*[^>]*>/gi ) || [] )
                     .map( t => t.replace( /\s[^>]*>/, '>' ).toLowerCase() ).sort();
   LANGS.filter( l => l !== 'en' ).forEach( lang => {
      const t = fx.FX_UI[lang];
      Object.keys( EN ).forEach( k => {
         if ( t[k] === undefined ) return;
         eq( tags( t[k] ).join( ',' ), tags( EN[k] ).join( ',' ),
             lang + '.' + k + ' carries the same markup as English' );
      } );
   } );
}

// ---------------------------------------------------------------------------
// The source stays portable. PJSR files are not guaranteed to be read as UTF-8,
// so accented characters live in the table as \uXXXX escapes - by the time the
// test sees them they are real characters again, which is the point: the escape
// is a source-encoding measure, and this asserts it survived it.
// ---------------------------------------------------------------------------
{
   ok( /[À-ſ]/.test( Object.keys( fx.FX_UI.fr ).map( k => fx.FX_UI.fr[k] ).join( '' ) ),
       'the French table really carries accented characters' );
   ok( !/[À-ſ]/.test( Object.keys( EN ).map( k => EN[k] ).join( '' ) ),
       'the English table needs none' );
}

// ---------------------------------------------------------------------------
// The accessor. Its fallbacks are what keep a half-finished translation
// readable rather than blank, and a missing key visible rather than silent.
// ---------------------------------------------------------------------------
{
   const saved = fx.FX.lang;

   fx.FX.lang = 'en';
   eq( fx.fxT( 'execute' ), EN.execute, 'fxT reads the English table' );
   fx.FX.lang = 'fr';
   eq( fx.fxT( 'execute' ), fx.FX_UI.fr.execute, 'fxT reads the French table' );
   ok( fx.fxT( 'execute' ) !== EN.execute, 'and the two differ, so the switch does something' );

   fx.FX.lang = 'de';
   eq( fx.fxT( 'execute' ), EN.execute, 'an unknown language falls back to English' );

   fx.FX.lang = 'fr';
   eq( fx.fxT( 'noSuchKeyAnywhere' ), 'noSuchKeyAnywhere',
       'a key in no table returns itself, so the gap is visible on screen' );

   fx.FX.lang = saved;
}

// ---------------------------------------------------------------------------
// The language survives a corrupt settings file, and is persisted at all.
// ---------------------------------------------------------------------------
{
   const declared = {};
   fx.FXPersisted.forEach( ( [ name, type ] ) => { declared[name] = type; } );
   eq( declared.lang, 'string', 'the language is persisted, as a string' );

   const saved = fx.FX.lang;
   [ 'de', '', 'EN', 'français', null, 42 ].forEach( bad => {
      fx.FX.lang = bad;
      fx.fxSanitize();
      ok( LANGS.indexOf( fx.FX.lang ) >= 0,
          'a stored language of ' + JSON.stringify( bad ) + ' comes back as one we have' );
   } );
   fx.FX.lang = saved;
}

// ---------------------------------------------------------------------------
// Every key is actually read, and no user-facing literal was left behind.
//
// This is the failure mode the table itself cannot see: a string translated
// into both languages and then never displayed, because the literal is still
// hard-coded in the dialog. The French is perfect, the test is green, and the
// interface stays English. It happened three times while this file was being
// built - twice to keys that had just been translated, and once to a tooltip
// deleted outright by an over-broad edit - so it is asserted rather than
// remembered.
// ---------------------------------------------------------------------------
{
   const fs = require( 'fs' );
   const path = require( 'path' );
   const root = path.join( __dirname, '..', 'pjsr' );
   const files = [ 'ForaxxPaletteStudio.js', 'lib/FXDialog.js', 'lib/FXProcessing.js',
                   'lib/FXPreview.js', 'lib/FXHistogram.js', 'lib/FXParameters.js' ];
   const code = files.map( f => fs.readFileSync( path.join( root, f ), 'utf8' ) ).join( '\n' );

   // Keys reached through a variable rather than a literal: the row helpers look
   // up fxT( name ) and fxT( name + "Tip" ) from the parameter name they are
   // given, the styles carry their key in the table, and the level sets carry
   // theirs as titleKey.
   const indirect = new Set();
   const add = ( re, tip ) => {
      let m;
      while ( ( m = re.exec( code ) ) !== null )
      {
         indirect.add( m[1] );
         if ( tip ) indirect.add( m[1] + 'Tip' );
      }
   };
   add( /fxNumericRow\(\s*this,\s*"(\w+)"/g, true );
   add( /fxCheckBox\(\s*this,\s*"(\w+)"/g, true );
   add( /fxComboRow\(\s*this,\s*"(\w+)"/g, true );
   add( /key:\s*"(\w+)"/g, false );
   add( /titleKey:\s*"(\w+)"/g, false );

   Object.keys( EN ).forEach( k => {
      ok( indirect.has( k ) || code.indexOf( 'fxT( "' + k + '" )' ) >= 0,
          'the string "' + k + '" is read somewhere - a translated key nothing '
          + 'displays leaves the interface in English' );
   } );

   // And the other direction: a literal sentence still sitting in the dialog is
   // a sentence that cannot be translated. Section bar titles are exempt - they
   // are constructed with an English default that applyLanguage overwrites.
   const dialog = fs.readFileSync( path.join( root, 'lib/FXDialog.js' ), 'utf8' )
                    .replace( /\/\*[\s\S]*?\*\//g, '' )
                    .replace( /^\s*\/\/.*$/gm, '' )
                    .replace( /(?:new SectionBar|fxSection)\([^)]*\)/g, '' );
   const leftovers = ( dialog.match( /"(?:[^"\\]|\\.){25,}"/g ) || [] )
      .filter( s => /^"[A-Z][a-z]+ [a-z]/.test( s ) );
   ok( leftovers.length === 0,
       'no English sentence is left hard-coded in the dialog'
       + ( leftovers.length ? ': ' + leftovers.slice( 0, 3 ).join( ' | ' ) : '' ) );
}

report( 'strings' );
