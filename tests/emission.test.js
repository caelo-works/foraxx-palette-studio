// Numeric emission — how a JavaScript number becomes a literal inside a
// PixelMath expression. Four separate faults between 2.3.4 and 2.6.1 lived
// here, and every one of them produced a plausible-looking expression that
// rendered wrong. Nothing downstream can detect a constant that lost its
// significant figures on the way out.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, near, report } = require( './assert.js' );

// ---------------------------------------------------------------------------
// Never exponential. PixelMath's acceptance of an exponent inside a literal is
// not something this codebase has confirmed, so fxNum must not emit one at any
// magnitude the pipeline can reach.
// ---------------------------------------------------------------------------
{
   const magnitudes = [ 1, 0.5, 0.1, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 0.999999, 3.0 ];
   magnitudes.forEach( v => {
      const s = fx.fxNum( v );
      ok( !/[eE]/.test( s ), 'fxNum(' + v + ') = "' + s + '" is fixed notation' );
      ok( /^-?[0-9]+\.[0-9]+$/.test( s ), 'fxNum(' + v + ') = "' + s + '" is a plain decimal' );
   } );
   ok( !/[eE]/.test( fx.fxNum( -1e-7 ) ), 'negative small values are fixed notation too' );
}

// ---------------------------------------------------------------------------
// Significant figures. Six decimals covers the [0,1] range the pipeline
// normally works in and reproduces the original script's expressions exactly.
// Below 1e-4 it switches to twelve, because six would leave a 2.5e-5 balance
// with two significant figures and a 3e-6 one with none - which is precisely
// what made the 2.3.4 nebula come out black.
// ---------------------------------------------------------------------------
{
   eq( fx.fxNum( 0.5 ), '0.500000', 'the ordinary range keeps six decimals' );
   eq( fx.fxNum( 1e-4 ), '0.000100', '1e-4 is still on the six-decimal side' );
   eq( fx.fxNum( 1e-5 ), '0.000010000000', 'below 1e-4 the precision deepens' );
   eq( fx.fxNum( 1e-8 ), '0.000000010000', 'and holds at the floor' );

   // The property behind those literals: four significant figures, always.
   [ 2.5e-5, 3e-6, 1e-7, 1e-8, 7.3e-6 ].forEach( v => {
      const back = Number( fx.fxNum( v ) );
      ok( back > 0, 'fxNum(' + v + ') does not round away to zero' );
      near( back / v, 1, 'fxNum(' + v + ') keeps four significant figures', 1e-3 );
   } );
}

// ---------------------------------------------------------------------------
// The coupling the source calls out explicitly: FX_MTF_MIN has to stay well
// above 10^-FX_NUM_DECIMALS. If a midtones balance ever rounded to a literal
// zero, the MTF denominator would be 0 at t = 0 and the whole background would
// come out NaN - a failure no clamp downstream can repair.
//
// This is the guard on that comment. It fails if someone lowers the floor or
// shortens the precision without moving the other.
// ---------------------------------------------------------------------------
{
   const floor = 1.0e-8;      // FX_MTF_MIN
   const emitted = fx.fxNum( floor );
   ok( Number( emitted ) > 0, 'the smallest emittable balance is not a literal zero' );
   ok( Number( emitted ) / floor > 0.999,
       'the smallest balance survives emission with its magnitude intact' );

   const decimals = ( emitted.split( '.' )[1] || '' ).length;
   ok( Math.pow( 10, -decimals ) <= floor / 1000,
       'there are at least three orders of margin between the floor and the last decimal' );
}

// ---------------------------------------------------------------------------
// The midtones transfer function as written into an expression.
// ---------------------------------------------------------------------------
{
   eq( fx.fxMTF( 'X', 0.5 ), 'X', 'a neutral balance emits no arithmetic at all' );
   eq( fx.fxMTF( 'X', 0.5 + 1e-9 ), 'X', 'and neither does one a rounding error away from it' );

   eq( fx.fxMTF( 'X', 0.25 ),
       '((0.750000*(X))/(0.250000 + (0.750000 - 0.250000)*(X)))',
       'the MTF is written with two constants, not three' );

   // The denominator is (1-m) + ... written as m + ((1-m) - m)*t rather than
   // with a separate literal for 1-2m: at t = 1 it collapses to exactly the
   // numerator's coefficient, so a sample of 1 maps to precisely 1.
   const expr = fx.fxMTF( 'X', 0.25 );
   const consts = expr.match( /[0-9]+\.[0-9]+/g );
   eq( new Set( consts ).size, 2, 'only two distinct constants are rounded' );
   ok( expr.indexOf( '-0.' ) < 0, 'no unary minus ever reaches the parser' );

   // Sampled against the definition, including deep into the small-m regime.
   [ 0.25, 0.1, 0.01, 1e-3, 1e-5, 1e-7 ].forEach( m => {
      const e = fx.fxMTF( 'T', m );
      [ 0, 0.25, 0.5, 1 ].forEach( t => {
         const value = Function( 'T', 'return ' + e.replace( /\(T\)/g, 'T' ) + ';' )( t );
         near( value, fx.fxMTFValue( m, t ),
               'the emitted MTF matches the function at m=' + m + ' t=' + t, 1e-6 );
      } );
      const at1 = Function( 'T', 'return ' + e.replace( /\(T\)/g, 'T' ) + ';' )( 1 );
      near( at1, 1, 'a sample of 1 maps to exactly 1 at m=' + m, 1e-12 );
      const at0 = Function( 'T', 'return ' + e.replace( /\(T\)/g, 'T' ) + ';' )( 0 );
      ok( isFinite( at0 ), 'and a sample of 0 is finite, not NaN, at m=' + m );
      near( at0, 0, 'and maps to 0 at m=' + m, 1e-12 );
   } );
}

// ---------------------------------------------------------------------------
// The shadow clip. Below 1e-6 the writer does not emit it at all, which the
// solver has to know about - a balance solved for a clipped input the
// expression never clips lands several times above target.
// ---------------------------------------------------------------------------
{
   eq( fx.fxStretch( 'X', 0, 0.5 ), 'X', 'no clip and a neutral balance is a no-op' );
   eq( fx.fxStretch( 'X', 1e-9, 0.5 ), 'X', 'a clip below the emission threshold is not written' );
   ok( fx.fxStretch( 'X', 0.02, 0.5 ).indexOf( '0.020000' ) >= 0,
       'a real clip is written' );
   ok( fx.fxStretch( 'X', 0.02, 0.3 ).indexOf( 'max(0,' ) >= 0,
       'the clip is floored at zero, so a pixel below it cannot go negative' );
}

// ---------------------------------------------------------------------------
// The dynamic factor, base^(k*~base). At k = 1 the multiplier is left out
// entirely: that is the published form, and the bit-for-bit promise is made of
// strings, not of values.
// ---------------------------------------------------------------------------
eq( fx.fxDynamicFactor( 'B', 1 ), '(B)^~(B)', 'k = 1 emits the published form exactly' );
eq( fx.fxDynamicFactor( 'B', 2 ), '(B)^(2.000000*~(B))', 'k != 1 carries the multiplier' );
eq( fx.fxBlendByMask( 'M', 'A', 'B' ), '(M)*(A) + ~(M)*(B)', 'the mask blend form' );

report( 'emission' );
