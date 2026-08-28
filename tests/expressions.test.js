// The expression layer — the PixelMath strings that decide what every user's
// image comes out looking like. A silent change here changes everybody's
// pictures, so the published forms are pinned literally rather than described.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, report } = require( './assert.js' );

const THREE = { sii: 'Sii', ha: 'Ha', oiii: 'Oiii' };
const TWO   = { sii: null,  ha: 'Ha', oiii: 'Oiii' };
const P = over => Object.assign( {}, fx.FX, over );
const styleNamed = frag => fx.FXStyles.findIndex( s => s.name.indexOf( frag ) === 0 );

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
   eq( e.o,  '(Oiii)^~(Oiii)',              'Sii/Ha mask' );
   eq( e.ho, '((Ha)*(Oiii))^~((Ha)*(Oiii))', 'Ha/Oiii mask' );

   // Every dynamic style that maps SHO starts from these same strings; what
   // separates them is the stored values, not the construction.
   ok( fx.FXStyles[0].dynamic, 'style 0 is the dynamic one the promise is about' );
}

// ---------------------------------------------------------------------------
// Fixed palettes at amount 0 are straight permutations — exactly what they were
// before the transitions were generalised to the RGB slots in 2.5.0. Anything
// else here means a fixed palette silently acquired a blend.
// ---------------------------------------------------------------------------
{
   const CHANNEL = { S: 'Sii', H: 'Ha', O: 'Oiii' };
   fx.FXStyles.forEach( ( style, idx ) => {
      if ( style.dynamic || !style.needsSii ) return;
      const e = fx.fxBuildExpressions( P( { styleIndex: idx, blend: 0 } ), THREE, THREE );
      eq( e.r, CHANNEL[style.map[0]], style.name + ' red is the mapping, untouched' );
      eq( e.g, CHANNEL[style.map[1]], style.name + ' green is the mapping, untouched' );
      eq( e.b, CHANNEL[style.map[2]], style.name + ' blue is the mapping, untouched' );
   } );
}

// ---------------------------------------------------------------------------
// Raising the amount on a fixed palette must walk it towards its own Foraxx
// counterpart, not somewhere else. At amount 1 with the SHO mapping it has to
// arrive at exactly the dynamic SHO strings.
// ---------------------------------------------------------------------------
{
   const sho = styleNamed( 'SHO (Hubble)' );
   ok( sho >= 0, 'the fixed SHO palette is in the table' );
   const walked  = fx.fxBuildExpressions( P( { styleIndex: sho, blend: 1 } ), THREE, THREE );
   const dynamic = fx.fxBuildExpressions( P( { styleIndex: 0 } ), THREE, THREE );
   eq( walked.r, dynamic.r, 'fixed SHO at amount 1 arrives at the dynamic red' );
   eq( walked.g, dynamic.g, 'fixed SHO at amount 1 arrives at the dynamic green' );
   eq( walked.b, dynamic.b, 'fixed SHO at amount 1 arrives at the dynamic blue' );
}

// ---------------------------------------------------------------------------
// Two-channel mappings. In HOO the green SLOT holds Oiii, so it is green that
// takes the Ha/Oiii blend; blue's Oiii must stay untouched. Blending per
// channel rather than per slot would drive green and blue to the same string —
// which is the bug 2.5.0 fixed by moving the transitions onto the slots.
// ---------------------------------------------------------------------------
{
   const hoo = styleNamed( 'HOO (bicolour)' );
   const e = fx.fxBuildExpressions( P( { styleIndex: hoo, blend: 0, twoChannels: true } ), TWO, TWO );
   eq( e.r, 'Ha',   'fixed HOO red' );
   eq( e.g, 'Oiii', 'fixed HOO green' );
   eq( e.b, 'Oiii', 'fixed HOO blue' );
   eq( e.o, null,   'no Sii means no Sii/Ha mask at all' );

   const d = fx.fxBuildExpressions( P( { styleIndex: styleNamed( 'Foraxx HOO' ), twoChannels: true } ),
                                    TWO, TWO );
   eq( d.b, 'Oiii', 'dynamic HOO leaves blue untouched' );
   ok( d.g !== d.b, 'dynamic HOO green and blue are different expressions' );
   eq( d.o, null,   'dynamic HOO has no Sii/Ha mask' );

   // Nothing in a two-channel palette may name a channel the user never gave.
   fx.FXStyles.forEach( ( style, idx ) => {
      if ( style.needsSii ) return;
      const x = fx.fxBuildExpressions( P( { styleIndex: idx, twoChannels: true } ), TWO, TWO );
      [ 'r', 'g', 'b' ].forEach( k =>
         ok( x[k] != null && x[k].indexOf( 'null' ) < 0 && x[k].indexOf( 'Sii' ) < 0,
             '"' + style.name + '" ' + k + ' never mentions a missing Sii' ) );
   } );
}

// ---------------------------------------------------------------------------
// Masks come from the STARLESS context even when the values come from the star
// channels. That is the original's behaviour and it is deliberate: the masks
// describe the nebula, and running them over a star field is what 2.4.0 stopped
// doing to star colour.
// ---------------------------------------------------------------------------
{
   const stars = { sii: 'sS', ha: 'sH', oiii: 'sO' };
   const e = fx.fxBuildExpressions( P( { styleIndex: 0 } ), THREE, stars );
   ok( e.o.indexOf( 'Oiii' ) >= 0 && e.o.indexOf( 'sO' ) < 0,
       'the Sii/Ha mask is built from the starless channels' );
   ok( e.ho.indexOf( 'Ha' ) >= 0 && e.ho.indexOf( 'sH' ) < 0,
       'the Ha/Oiii mask is built from the starless channels' );
   ok( e.r.indexOf( 'sS' ) >= 0, 'but the values come from the star channels' );
   eq( e.b, 'sO', 'blue takes the star channel directly' );
}

// ---------------------------------------------------------------------------
// Channel weights feed the masks as well as the slots, which is why moving one
// moves the gold/teal boundary rather than just the brightness.
// ---------------------------------------------------------------------------
{
   const e = fx.fxBuildExpressions( P( { styleIndex: 0, gainOiii: 1.5 } ), THREE, THREE );
   ok( e.o.indexOf( '1.500000' ) >= 0, 'the Oiii weight reaches the Sii/Ha mask' );
   ok( e.ho.indexOf( '1.500000' ) >= 0, 'and the Ha/Oiii mask' );

   const neutral = fx.fxBuildExpressions( P( { styleIndex: 0 } ), THREE, THREE );
   ok( neutral.o.indexOf( '*' ) < 0 || neutral.o === '(Oiii)^~(Oiii)',
       'a neutral weight adds nothing to the mask' );
}

// ---------------------------------------------------------------------------
// The identities that keep a control at its neutral position free. A slider
// that emits arithmetic at its own default costs precision for nothing, and the
// "unchanged at default" claims in the README rest on these.
// ---------------------------------------------------------------------------
eq( fx.fxGain( 'X', 1 ), 'X',         'gain 1 is the identity' );
eq( fx.fxMix( 'A', 'B', 1 ), 'A',     'mix at 1 is the first term alone' );
eq( fx.fxMix( 'A', 'B', 0 ), 'B',     'mix at 0 is the second term alone' );
eq( fx.fxMix( 'A', 'B', 0.5 ), '(0.500000*(A) + 0.500000*(B))', 'mix interpolates' );
eq( fx.fxGain( 'X', 1.5 ), '((1.500000*(X))/(1 + 0.500000*(X)))', 'gain is the soft MTF form' );

// ---------------------------------------------------------------------------
// The broadband star combination. Published ratios: R = 0.5*Ha + 0.5*Sii,
// G = 0.3*Ha + 0.7*Oiii, B = Oiii. With no Sii, Ha stands in for it — which is
// what the reference script does, rather than dropping the term.
// ---------------------------------------------------------------------------
{
   eq( fx.FX_STAR_HA_TO_OIII, 0.30, 'the published Ha-to-Oiii ratio' );

   const e = fx.fxBuildStarRGBExpressions( P( {} ), THREE );
   eq( e.r, '0.5*(Ha) + 0.5*(Sii)', 'star red is the published half-and-half' );
   eq( e.g, '0.300000*(Ha) + 0.700000*(Oiii)', 'star green is the published 0.3 / 0.7' );
   eq( e.b, 'Oiii', 'star blue is Oiii' );
   eq( e.o, null, 'the star combination is broadband, so it carries no dynamic mask' );

   const two = fx.fxBuildStarRGBExpressions( P( { twoChannels: true } ), TWO );
   eq( two.r, '0.5*(Ha) + 0.5*(Ha)', 'with no Sii, Ha stands in on both halves' );
   eq( two.g, '0.300000*(Ha) + 0.700000*(Oiii)', 'green is unchanged by the channel count' );
}

// ---------------------------------------------------------------------------
// The star brightening curve. 3^k is left for PixelMath to evaluate rather than
// computed here and rounded — at k = 8 the equivalent midtones balance is
// 1/6562, which does not survive six decimals.
// ---------------------------------------------------------------------------
{
   eq( fx.fxBuildStarStretchExpression( 5 ), '((3^5.00)*$T)/((3^5.00-1)*$T+1)',
       'star stretch keeps 3^k symbolic' );
   ok( fx.fxBuildStarStretchExpression( 8 ).indexOf( '3^8.00' ) >= 0,
       'star stretch stays symbolic at high k' );
   eq( fx.fxBuildStarStretchExpression( 0 ), null,
       'a star stretch of 0 is a genuine no-op, not an identity curve to evaluate' );

   // It fixes 0 and 1 and is monotonic for every k >= 0, so it lifts faint stars
   // hard without ever clipping a bright core. Checked by evaluating the emitted
   // string - PixelMath's ^ is exponentiation, where JavaScript's is XOR, so it
   // is translated before evaluation rather than silently computing nonsense.
   const evaluate = ( e, t ) => Function(
      'T', 'return ' + e.replace( /3\^([0-9.]+)/g, 'Math.pow(3,$1)' ).replace( /\$T/g, 'T' ) + ';'
   )( t );
   [ 0.5, 2, 5, 8 ].forEach( k => {
      const e = fx.fxBuildStarStretchExpression( k );
      const f = t => evaluate( e, t );
      ok( Math.abs( f( 0 ) - 0 ) < 1e-12, 'star stretch fixes 0 at k=' + k );
      ok( Math.abs( f( 1 ) - 1 ) < 1e-12, 'star stretch fixes 1 at k=' + k );
      ok( f( 0.2 ) < f( 0.5 ) && f( 0.5 ) < f( 0.9 ), 'star stretch is monotonic at k=' + k );
      ok( f( 0.01 ) > 0.01, 'star stretch lifts a faint star at k=' + k );
      ok( f( 0.9 ) <= 1, 'star stretch never pushes a bright core past 1 at k=' + k );
   } );
   // The lift is what 2.3.5 measured: a star at 0.05 must not stay at 0.05.
   ok( evaluate( fx.fxBuildStarStretchExpression( 5 ), 0.05 ) > 0.9,
       'at k = 5 a faint star is lifted hard, as the reference does' );
}

// ---------------------------------------------------------------------------
// Screen combination of starless and stars. It cannot go below the brighter
// input, which is what made the 2.6.1 grey floor visible everywhere.
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
   [ 1, 2, 8, 32 ].forEach( n => {
      const e = fx.fxBuildPosteriseExpressions( n );
      [ 'r', 'g', 'b' ].forEach( k =>
         ok( e[k].indexOf( '/0' ) < 0 && !/\*0\.0+ /.test( e[k] ),
             'posterise at ' + n + ' levels never divides by zero (' + k + ')' ) );
   } );
}

// ---------------------------------------------------------------------------
// HDR compression. The whole section is off by default and must emit nothing at
// all when it is - 2.3.3 turned it into a switched section precisely so that
// nothing in it runs unless it is asked for.
// ---------------------------------------------------------------------------
{
   // Both halves, and the non-vacuous one first: this used to pass with a
   // default amount of 0 and would have kept passing if the flag were deleted.
   eq( fx.fxBuildHDRCompression( P( { hdrEnabled: false, hdrAmount: 0.5 } ) ), null,
       'the section switched off emits nothing even with an amount set' );
   eq( fx.fxBuildHDRCompression( P( { hdrEnabled: false, hdrAmount: 0 } ) ), null,
       'and nothing when the amount is zero as well' );
   eq( fx.fxBuildHDRCompression( P( { hdrEnabled: true, hdrAmount: 0 } ) ), null,
       'switched on with nothing asked for is still nothing' );

   const e = fx.fxBuildHDRCompression( P( { hdrEnabled: true, hdrAmount: 0.5, hdrKnee: 0.6 } ) );
   ok( e != null && typeof e.expression === 'string', 'switched on it emits an expression' );
   ok( typeof e.symbols === 'string' && e.symbols.length > 0, 'with its symbol list' );
   // Every symbol the expression assigns has to be declared, or PixelMath
   // treats it as an image identifier and the run fails on a missing view.
   const declared = new Set( e.symbols.split( ',' ).map( s => s.trim() ) );
   ( e.expression.match( /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/gm ) || [] ).forEach( line => {
      const name = line.replace( /\s|=/g, '' );
      ok( declared.has( name ), 'HDR symbol "' + name + '" is declared' );
   } );
   ok( e.expression.indexOf( '0.2126' ) >= 0 && e.expression.indexOf( '0.7152' ) >= 0,
       'luminance uses the Rec. 709 coefficients' );
   ok( /Y <= 0\.0+1/.test( e.expression ) || e.expression.indexOf( 'iif(' ) >= 0,
       'the division by luminance is guarded against zero' );
}

// ---------------------------------------------------------------------------
// Artificial luminance. The substitution preserves the colour ratios and stops
// where a channel would clip, whatever the amount.
// ---------------------------------------------------------------------------
{
   [ 0, 0.5, 1 ].forEach( amount => {
      const e = fx.fxBuildLuminanceApplyExpressions( P( { lumApply: amount } ), 'Lum' );
      [ 'r', 'g', 'b' ].forEach( ( k, i ) => {
         ok( e[k].indexOf( '$T[' + i + ']' ) >= 0,
             'the ' + k + ' expression scales its own channel at amount ' + amount );
         ok( e[k].indexOf( 'min(1,' ) === 0,
             'the ' + k + ' expression clips at 1 at amount ' + amount );
         ok( e[k].indexOf( 'max(' ) >= 0,
             'the ' + k + ' expression guards its divisions at amount ' + amount );
      } );
      if ( amount > 0 )
         ok( e.r.indexOf( 'Lum' ) >= 0, 'the layer is named at amount ' + amount );
   } );

   // The scale factor is shared by the three channels, which is what preserves
   // the ratios; only the trailing $T[n] differs.
   const e = fx.fxBuildLuminanceApplyExpressions( P( { lumApply: 0.5 } ), 'Lum' );
   const strip = s => s.replace( /\$T\[[0-2]\]\)$/, '' );
   eq( strip( e.r ), strip( e.g ), 'red and green share one scale factor' );
   eq( strip( e.g ), strip( e.b ), 'green and blue share one scale factor' );
}

report( 'expressions' );
