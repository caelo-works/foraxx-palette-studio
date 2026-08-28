// Output naming. The README promises that existing identifiers are never
// overwritten, and that a numeric suffix is added to the WHOLE GROUP at once —
// Warhol01, Warhol01_stars, Warhol01_combined and Warhol01_L always match.
// A mixture of numbered and unnumbered names is the failure this guards.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, report } = require( './assert.js' );

const SUFFIXES = [ '', '_stars', '_combined', '_o', '_ho', '_L' ];

// ---------------------------------------------------------------------------
// A single identifier.
// ---------------------------------------------------------------------------
{
   fx.fxTestSetViews( [] );
   eq( fx.fxUniqueViewId( 'Foraxx' ), 'Foraxx', 'a free identifier is used as it is' );

   fx.fxTestSetViews( [ 'Foraxx' ] );
   eq( fx.fxUniqueViewId( 'Foraxx' ), 'Foraxx01', 'a taken identifier gets a two-digit suffix' );

   fx.fxTestSetViews( [ 'Foraxx', 'Foraxx01', 'Foraxx02' ] );
   eq( fx.fxUniqueViewId( 'Foraxx' ), 'Foraxx03', 'and counts past every taken one' );

   fx.fxTestSetViews( Array.from( { length: 12 }, ( _, i ) =>
      i === 0 ? 'Foraxx' : 'Foraxx' + String( i ).padStart( 2, '0' ) ) );
   eq( fx.fxUniqueViewId( 'Foraxx' ), 'Foraxx12', 'the suffix stays two digits past nine' );
}

// ---------------------------------------------------------------------------
// The whole group moves together. Any one suffix being taken has to push the
// base, or Execute writes Foraxx next to an unrelated Foraxx_stars from an
// earlier run and the two no longer describe the same image.
// ---------------------------------------------------------------------------
{
   SUFFIXES.forEach( suffix => {
      fx.fxTestSetViews( [ 'Foraxx' + suffix ] );
      eq( fx.fxUniqueBaseId( 'Foraxx' ), 'Foraxx01',
          'a taken "' + ( suffix || '<base>' ) + '" moves the whole group' );
   } );

   fx.fxTestSetViews( [] );
   eq( fx.fxUniqueBaseId( 'Foraxx' ), 'Foraxx', 'a clear workspace keeps the plain name' );

   // The realistic case: a complete previous run is on screen.
   fx.fxTestSetViews( SUFFIXES.map( s => 'Foraxx' + s ) );
   eq( fx.fxUniqueBaseId( 'Foraxx' ), 'Foraxx01', 'a complete previous run pushes to 01' );

   // And a partial second run must not collide with either.
   fx.fxTestSetViews( SUFFIXES.map( s => 'Foraxx' + s ).concat( [ 'Foraxx01_L' ] ) );
   eq( fx.fxUniqueBaseId( 'Foraxx' ), 'Foraxx02',
       'a single leftover from run 01 pushes the next run to 02' );

   // Whatever it returns has to be free across every suffix, which is the
   // property the README states.
   [ [], [ 'Foraxx' ], [ 'Foraxx_L' ], SUFFIXES.map( s => 'Foraxx' + s ),
     [ 'Foraxx', 'Foraxx01_stars', 'Foraxx02_combined' ] ].forEach( ( taken, i ) => {
      fx.fxTestSetViews( taken );
      const base = fx.fxUniqueBaseId( 'Foraxx' );
      SUFFIXES.forEach( s =>
         ok( taken.indexOf( base + s ) < 0,
             'case ' + i + ': "' + base + s + '" is free, so the group is coherent' ) );
   } );
}

// ---------------------------------------------------------------------------
// Names carried by the styles have to survive this untouched when nothing is in
// the way — the README says the output name follows whichever palette you pick.
// ---------------------------------------------------------------------------
{
   fx.fxTestSetViews( [] );
   fx.FXStyles.forEach( style => {
      eq( fx.fxUniqueBaseId( style.id ), style.id,
          '"' + style.name + '" keeps its output name on a clear workspace' );
   } );
}

report( 'naming' );
