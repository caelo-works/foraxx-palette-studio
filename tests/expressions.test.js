// Expression layer — the PixelMath strings that decide what every user's image
// comes out looking like. A silent change here changes everybody's pictures, so
// the published forms are pinned literally rather than described.
'use strict';

const fx = require( './build/module.js' );

let failed = 0;
function eq( actual, expected, what )
{
   if ( actual === expected )
      return;
   failed++;
   console.error( 'FAIL ' + what + '\n  expected: ' + expected + '\n  actual:   ' + actual );
}
function ok( cond, what )
{
   if ( !cond ) { failed++; console.error( 'FAIL ' + what ); }
}

const THREE = { sii: 'Sii', ha: 'Ha', oiii: 'Oiii' };
const TWO   = { sii: null,  ha: 'Ha', oiii: 'Oiii' };
const P = over => Object.assign( {}, fx.FX, over );

// ---------------------------------------------------------------------------
// The dynamic SHO palette, at defaults.
//
// These are Bill Blanshan's published expressions character for character:
//
//    R = O^~O * S  +  ~(O^~O) * H
//    G = (H*O)^~(H*O) * H  +  ~((H*O)^~(H*O)) * O
//    B = O
//
// The README's headline promise is that "Foraxx - classic" at defaults yields a
// starless image identical, bit for bit, to the original Foraxx Palette Utility.
// That promise IS these three strings. Do not "tidy" them.
// ---------------------------------------------------------------------------
{
   const e = fx.fxBuildExpressions( P( { styleIndex: 0 } ), THREE, THREE );
   eq( e.r, '((Oiii)^~(Oiii))*(Sii) + ~((Oiii)^~(Oiii))*(Ha)', 'dynamic SHO red' );
   eq( e.g, '(((Ha)*(Oiii))^~((Ha)*(Oiii)))*(Ha) + ~(((Ha)*(Oiii))^~((Ha)*(Oiii)))*(Oiii)',
       'dynamic SHO green' );
   eq( e.b, 'Oiii', 'dynamic SHO blue is the anchor and is never blended' );
   eq( e.o,  '(Oiii)^~(Oiii)',             'Sii/Ha mask' );
   eq( e.ho, '((Ha)*(Oiii))^~((Ha)*(Oiii))', 'Ha/Oiii mask' );
}

// ---------------------------------------------------------------------------
// Fixed palettes at amount 0 are straight permutations — exactly what they were
// before the transitions were generalised to the RGB slots (2.5.0). Anything
// else here means a fixed palette silently acquired a blend.
// ---------------------------------------------------------------------------
{
   const cases = {
      7:  [ 'Sii', 'Ha',  'Oiii' ],   // SHO
      8:  [ 'Ha',  'Sii', 'Oiii' ],   // HSO
      9:  [ 'Ha',  'Oiii', 'Sii' ],   // HOS
      10: [ 'Oiii', 'Ha', 'Sii' ],    // OHS
      11: [ 'Oiii', 'Sii', 'Ha' ],    // OSH
      12: [ 'Sii', 'Oiii', 'Ha' ]     // SOH
   };
   for ( const idx of Object.keys( cases ) )
   {
      const style = fx.FXStyles[idx];
      const e = fx.fxBuildExpressions( P( { styleIndex: Number( idx ), blend: 0 } ), THREE, THREE );
      const [ r, g, b ] = cases[idx];
      eq( e.r, r, style.name + ' red is the mapping, untouched' );
      eq( e.g, g, style.name + ' green is the mapping, untouched' );
      eq( e.b, b, style.name + ' blue is the mapping, untouched' );
   }
}

// ---------------------------------------------------------------------------
// Two-channel mappings. In HOO the green SLOT holds Oiii, so it is green that
// takes the Ha/Oiii blend; blue's Oiii must stay untouched. Blending per
// channel rather than per slot would drive green and blue to the same string —
// which is the bug 2.5.0 fixed by moving the transitions onto the slots.
// ---------------------------------------------------------------------------
{
   const e = fx.fxBuildExpressions( P( { styleIndex: 13, blend: 0, twoChannels: true } ), TWO, TWO );
   eq( e.r, 'Ha',   'fixed HOO red' );
   eq( e.g, 'Oiii', 'fixed HOO green' );
   eq( e.b, 'Oiii', 'fixed HOO blue' );
   eq( e.o, null,   'no Sii means no Sii/Ha mask at all' );

   const d = fx.fxBuildExpressions( P( { styleIndex: 5, twoChannels: true } ), TWO, TWO );
   eq( d.b, 'Oiii', 'dynamic HOO leaves blue untouched' );
   ok( d.g !== d.b, 'dynamic HOO green and blue are different expressions' );
   ok( d.o === null, 'dynamic HOO has no Sii/Ha mask' );
}

// ---------------------------------------------------------------------------
// The identities that keep a control at its neutral position free. A slider
// that emits arithmetic at its own default is a slider that costs precision for
// nothing, and the "unchanged at default" claims in the README rest on these.
// ---------------------------------------------------------------------------
eq( fx.fxGain( 'X', 1 ), 'X',         'gain 1 is the identity' );
eq( fx.fxMix( 'A', 'B', 1 ), 'A',     'mix at 1 is the first term alone' );
eq( fx.fxMix( 'A', 'B', 0 ), 'B',     'mix at 0 is the second term alone' );
eq( fx.fxMix( 'A', 'B', 0.5 ), '(0.500000*(A) + 0.500000*(B))', 'mix interpolates' );
eq( fx.fxGain( 'X', 1.5 ), '((1.500000*(X))/(1 + 0.500000*(X)))', 'gain is the MTF form' );

// ---------------------------------------------------------------------------
// Numeric emission. Fixed notation, six decimals: PixelMath's acceptance of
// exponential literals is what four separate 2.3.x-era faults turned on, so the
// formatter must never reach for it.
// ---------------------------------------------------------------------------
eq( fx.fxNum( 0.5 ), '0.500000', 'six decimals, fixed notation' );
ok( fx.fxNum( 1e-7 ).indexOf( 'e' ) < 0, 'small values never emit exponential notation' );

// ---------------------------------------------------------------------------
// The star brightening curve. 3^k is left for PixelMath to evaluate rather than
// computed here and rounded — at k = 8 the midtones balance is 1/6562, which
// does not survive six decimals.
// ---------------------------------------------------------------------------
eq( fx.fxBuildStarStretchExpression( 5 ), '((3^5.00)*$T)/((3^5.00-1)*$T+1)',
    'star stretch keeps 3^k symbolic' );
ok( fx.fxBuildStarStretchExpression( 8 ).indexOf( '3^8.00' ) >= 0,
    'star stretch stays symbolic at high k' );

// ---------------------------------------------------------------------------
// Screen combination of starless and stars.
// ---------------------------------------------------------------------------
eq( fx.fxBuildCombineExpression( 'SL', 'ST' ), '~(~SL * ~ST)', 'screen combination' );

// ---------------------------------------------------------------------------
// Posterisation: n levels means n-1 steps, rounded to nearest.
// ---------------------------------------------------------------------------
{
   const p = fx.fxBuildPosteriseExpressions( 4 );
   eq( p.r, 'floor($T[0]*3.000000 + 0.5)/3.000000', 'posterise red' );
   eq( p.g, 'floor($T[1]*3.000000 + 0.5)/3.000000', 'posterise green' );
   eq( p.b, 'floor($T[2]*3.000000 + 0.5)/3.000000', 'posterise blue' );
}

// ---------------------------------------------------------------------------
// Style table invariants. The dialog indexes into this table and settings files
// store the index, so a reordering silently repoints everyone's saved palette.
// ---------------------------------------------------------------------------
{
   ok( fx.FXStyles.length > 0, 'there is a style table' );
   fx.FXStyles.forEach( ( s, i ) => {
      ok( typeof s.name === 'string' && s.name.length > 0, 'style ' + i + ' has a name' );
      ok( /^[SHO]{3}$/.test( s.map ), 'style ' + i + ' maps three channels' );
      ok( typeof s.needsSii === 'boolean', 'style ' + i + ' declares its channel count' );
   } );
   ok( fx.FXStyles[0].map === 'SHO' && fx.FXStyles[0].dynamic,
       'the first style is the dynamic SHO the README calls the original' );
   const two = fx.fxFirstStyleFor( true );
   ok( fx.FXStyles[two].needsSii === false, 'fxFirstStyleFor(2 channels) picks a 2-channel style' );
   const three = fx.fxFirstStyleFor( false );
   ok( fx.FXStyles[three].needsSii === true, 'fxFirstStyleFor(3 channels) picks a 3-channel style' );
}

if ( failed )
{
   console.error( failed + ' assertion(s) failed.' );
   process.exit( 1 );
}
console.log( 'expressions: all assertions passed.' );
