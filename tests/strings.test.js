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

report( 'strings' );
