// Channel conditioning — the arithmetic that decides how bright the result is.
// This is where every linear-input fault between 2.3.4 and 2.6.1 lived, and
// where the case for withdrawing linear support in 3.0.0 is made or broken.
'use strict';

const fx = require( './build/module.js' );
const { eq, ok, near, report } = require( './assert.js' );

const P = over => Object.assign( {}, fx.FX, over );
const NORM = over => P( Object.assign( {
   normalizeEnabled: true, normalizeRef: 1,        // reference = Ha
   normSii: 1, normHa: 1, normOiii: 1, normShadow: 0.25
}, over ) );

// ---------------------------------------------------------------------------
// The midtones transfer function and its solver.
//
// Argument order is fxMTFValue( m, x ) and fxSolveMTF( x, target ) -> m. They
// are inverses, and the whole conditioning stage rests on that: the solver
// picks the m that puts a channel's median exactly on its target.
// ---------------------------------------------------------------------------
near( fx.fxMTFValue( 0.5, 0.25 ), 0.25, 'm = 0.5 is the identity' );
near( fx.fxMTFValue( 0.5, 0.80 ), 0.80, 'm = 0.5 is the identity anywhere' );
near( fx.fxMTFValue( 0, 0.4 ), 0.4 / (0.4 + 0), 'm = 0 saturates', 1e-9 );
ok( fx.fxMTFValue( 0.25, 0.5 ) > 0.5, 'm below 0.5 lifts' );
ok( fx.fxMTFValue( 0.75, 0.5 ) < 0.5, 'm above 0.5 darkens' );

for ( const [ x, target ] of [ [ 0.05, 0.25 ], [ 0.002, 0.25 ], [ 0.3, 0.5 ], [ 0.6, 0.2 ] ] )
{
   const m = fx.fxSolveMTF( x, target );
   near( fx.fxMTFValue( m, x ), target,
         'solve then apply is a round trip at x=' + x + ' target=' + target, 1e-9 );
}
near( fx.fxSolveMTF( 0.4, 0.4 ), 0.5, 'a target equal to the input asks for the identity', 1e-12 );

// ---------------------------------------------------------------------------
// The black point. Interpolated from the channel minimum towards its median by
// the Shadow point control, and only when normalization is on.
// ---------------------------------------------------------------------------
{
   const stats = { median: 0.20, madn: 0.02, minimum: 0.04 };
   eq( fx.fxBlackPointFor( stats, P( { normalizeEnabled: false } ) ), 0,
       'normalization off conditions nothing, so there is no black point' );
   near( fx.fxBlackPointFor( stats, NORM( { normShadow: 0 } ) ), 0.04,
         'shadow point 0 sits on the minimum' );
   near( fx.fxBlackPointFor( stats, NORM( { normShadow: 1 } ) ), 0.20,
         'shadow point 1 sits on the median' );
   near( fx.fxBlackPointFor( stats, NORM( { normShadow: 0.25 } ) ), 0.04 + 0.25 * 0.16,
         'shadow point interpolates between them' );

   near( fx.fxMedianAfterBlackPoint( stats, 0.04 ), ( 0.20 - 0.04 ) / ( 1 - 0.04 ),
         'the median is rescaled once the black point is subtracted' );
   eq( fx.fxMedianAfterBlackPoint( { median: 0.1 }, 1 ), 0,
       'a black point at 1 leaves nothing above it' );
}

// ---------------------------------------------------------------------------
// The boost is per channel and only means anything with normalization on.
// ---------------------------------------------------------------------------
eq( fx.fxNormalizationBoost( NORM( { normSii: 1.4 } ), 'sii' ), 1.4, 'Sii boost' );
eq( fx.fxNormalizationBoost( NORM( { normOiii: 0.8 } ), 'oiii' ), 0.8, 'Oiii boost' );
eq( fx.fxNormalizationBoost( NORM( { normHa: 1.1 } ), 'ha' ), 1.1, 'Ha boost' );
eq( fx.fxNormalizationBoost( P( { normalizeEnabled: false } ), 'sii' ), 1,
    'with normalization off every boost is 1' );

// ---------------------------------------------------------------------------
// Nothing conditions a channel while normalization is off. This is the whole
// reason the script cannot take linear data: there is no other stage that
// touches channel brightness.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   const p = P( { normalizeEnabled: false } );
   const v = fx.fxTestView( 'A', { median: 0.1, madn: 0.01, minimum: 0.01 } );
   eq( fx.fxStretchMapFor( p, v, v, v ), null, 'normalization off returns no transform map' );
   eq( fx.fxChannelTransform( v, p, 'ha', 0.1 ), null, 'and no per-channel transform' );
   eq( fx.fxCollectStretch( p, false ), null, 'and nothing is collected for the pipeline' );
}

// ---------------------------------------------------------------------------
// Normalization on stretched channels: the reference is left alone and the
// others are moved onto it. This is what the stage is for.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   const p = NORM();
   const sii  = fx.fxTestView( 'S', { median: 0.08, madn: 0.01, minimum: 0.01 } );
   const ha   = fx.fxTestView( 'H', { median: 0.15, madn: 0.02, minimum: 0.02 } );
   const oiii = fx.fxTestView( 'O', { median: 0.05, madn: 0.01, minimum: 0.005 } );
   const map = fx.fxStretchMapFor( p, sii, ha, oiii );

   ok( map != null, 'a transform map is produced' );
   near( map.ha.m, 0.5, 'the reference channel is left at the identity at boost 1', 1e-12 );
   ok( map.sii.m < 0.5, 'a channel below the reference is lifted' );
   ok( map.oiii.m < 0.5, 'the dimmest channel is lifted hardest' );
   ok( map.oiii.m < map.sii.m, 'and more than the one that started closer' );

   // Every channel must land on the reference median, which is what "bring Sii,
   // Ha and Oiii to a common brightness" actually means.
   const refMedian = ( 0.15 - map.ha.c0 ) / ( 1 - map.ha.c0 );
   for ( const [ key, median ] of [ [ 'sii', 0.08 ], [ 'ha', 0.15 ], [ 'oiii', 0.05 ] ] )
   {
      const c0 = map[key].c0;
      const xm = ( median - c0 ) / ( 1 - c0 );
      near( fx.fxMTFValue( map[key].m, xm ), refMedian,
            key + ' is moved onto the reference median', 1e-6 );
   }
}

// ---------------------------------------------------------------------------
// A per-channel boost is a RELATIVE statement about the reference.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   const p = NORM( { normOiii: 0.8 } );
   const sii  = fx.fxTestView( 'S2', { median: 0.08, madn: 0.01, minimum: 0.01 } );
   const ha   = fx.fxTestView( 'H2', { median: 0.15, madn: 0.02, minimum: 0.02 } );
   const oiii = fx.fxTestView( 'O2', { median: 0.05, madn: 0.01, minimum: 0.005 } );
   const map = fx.fxStretchMapFor( p, sii, ha, oiii );
   const refMedian = ( 0.15 - map.ha.c0 ) / ( 1 - map.ha.c0 );
   const c0 = map.oiii.c0;
   near( fx.fxMTFValue( map.oiii.m, ( 0.05 - c0 ) / ( 1 - c0 ) ), refMedian * 0.8,
         'a boost of 0.8 puts Oiii at 0.8x of the reference', 1e-6 );
}

// ---------------------------------------------------------------------------
// LINEAR INPUT. The load-bearing test.
//
// 3.0.0 withdrew linear support and kept channel normalization, and the two
// facts are easy to confuse: normalization does condition channels, so it looks
// like it could stand in for the missing stretch. It cannot, because its target
// is the REFERENCE CHANNEL'S OWN median - a relative statement. On linear data
// that median is near zero, every target collapses onto the 0.001 clamp, and
// the result is black.
//
// If this test ever fails because a channel lands somewhere bright, someone has
// introduced an absolute stretch target. That is the work needed to bring
// linear input back - and when it happens, the README, the dialog banner and
// the file header all have to stop saying linear is unsupported.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   const p = NORM();
   const sii  = fx.fxTestView( 'LS', { median: 3e-5, madn: 5e-6, minimum: 1e-5 } );
   const ha   = fx.fxTestView( 'LH', { median: 5e-5, madn: 8e-6, minimum: 1e-5 } );
   const oiii = fx.fxTestView( 'LO', { median: 2e-5, madn: 4e-6, minimum: 1e-5 } );
   const map = fx.fxStretchMapFor( p, sii, ha, oiii );

   ok( map != null, 'linear channels still produce a map - normalization runs' );
   for ( const key of [ 'sii', 'ha', 'oiii' ] )
   {
      const c0 = map[key].c0;
      const median = { sii: 3e-5, ha: 5e-5, oiii: 2e-5 }[key];
      const out = fx.fxMTFValue( map[key].m, ( median - c0 ) / ( 1 - c0 ) );
      near( out, 0.001, key + ' lands on the 0.001 clamp, not on a display level', 1e-5 );
      ok( out < 0.01, key + ' is still black: normalization is no substitute for a stretch' );
   }
}

// ---------------------------------------------------------------------------
// A reference channel with nothing above its black point cannot say where the
// others belong. Say so and leave everything alone rather than normalising onto
// an invented level.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   fx.fxTestConsoleReset();
   const p = NORM( { normShadow: 1 } );   // black point sits on the median
   const flat = fx.fxTestView( 'FLAT', { median: 0.1, madn: 0.01, minimum: 0.1 } );
   eq( fx.fxStretchMapFor( p, flat, flat, flat ), null,
       'an empty reference channel produces no map at all' );
   ok( fx.fxTestConsole().warnings.some( w => /reference channel has no signal/.test( w ) ),
       'and the user is told why, in the console' );
   ok( fx.fxTestConsole().warnings.some( w => /NON-LINEAR/.test( w ) ),
       'with the linear requirement named, because that is the usual cause' );
}

// ---------------------------------------------------------------------------
// A non-finite median - NaN borders from registration - must not reach the
// expression writer. fxClamp passes NaN straight through, so it is caught here.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   fx.fxTestConsoleReset();
   const stats = fx.fxChannelStats( fx.fxTestView( 'NAN', { median: NaN, madn: 0.01, minimum: 0 } ) );
   eq( stats.median, 0, 'a NaN median is replaced by zero' );
   ok( fx.fxTestConsole().warnings.some( w => /non-finite median/.test( w ) ),
       'and reported, because it points at registration borders' );
}

// ---------------------------------------------------------------------------
// The linear detector behind the status line. A stretched narrowband frame sits
// around 0.05 to 0.3; a linear one is orders of magnitude below.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   const linear = P( {
      siiView:  fx.fxTestView( 'l1', { median: 3e-5 } ),
      haView:   fx.fxTestView( 'l2', { median: 5e-5 } ),
      oiiiView: fx.fxTestView( 'l3', { median: 2e-5 } )
   } );
   ok( fx.fxLooksLinear( linear ), 'linear channels are detected' );

   fx.fxClearStatsCache();
   const stretched = P( {
      siiView:  fx.fxTestView( 's1', { median: 0.08 } ),
      haView:   fx.fxTestView( 's2', { median: 0.15 } ),
      oiiiView: fx.fxTestView( 's3', { median: 0.05 } )
   } );
   ok( !fx.fxLooksLinear( stretched ), 'stretched channels are not' );

   fx.fxClearStatsCache();
   const mixed = P( {
      siiView:  fx.fxTestView( 'm1', { median: 3e-5 } ),
      haView:   fx.fxTestView( 'm2', { median: 0.15 } ),
      oiiiView: null
   } );
   ok( !fx.fxLooksLinear( mixed ),
       'one stretched channel is enough to call the set non-linear' );

   ok( !fx.fxLooksLinear( P( { siiView: null, haView: null, oiiiView: null } ) ),
       'with nothing selected there is nothing to warn about' );
}

// ---------------------------------------------------------------------------
// Curve scaling. Strength 0 must be a genuine no-op, 1 the original exactly.
// ---------------------------------------------------------------------------
{
   const pts = [ [ 0, 0 ], [ 0.25, 0.40 ], [ 0.75, 0.60 ], [ 1, 1 ] ];
   const identity = fx.fxScaleCurve( pts, 0 );
   identity.forEach( ( pt, i ) => near( pt[1], pt[0], 'strength 0 is the identity at point ' + i ) );
   const original = fx.fxScaleCurve( pts, 1 );
   original.forEach( ( pt, i ) => near( pt[1], pts[i][1], 'strength 1 is the original at point ' + i ) );
   const doubled = fx.fxScaleCurve( pts, 2 );
   near( doubled[1][1], 0.25 + 2 * ( 0.40 - 0.25 ), 'strength 2 doubles the departure' );
   doubled.forEach( pt => ok( pt[1] >= 0 && pt[1] <= 1, 'a scaled curve stays inside [0,1]' ) );

   const deltas = [ [ 0.1, 0.5 ], [ 0.5, -0.4 ] ];
   fx.fxScaleDeltaCurve( deltas, 0 ).forEach( pt => eq( pt[1], 0, 'strength 0 zeroes every delta' ) );
   near( fx.fxScaleDeltaCurve( deltas, 2 )[0][1], 1.0, 'a delta is clamped at +1' );
   near( fx.fxScaleDeltaCurve( deltas, 4 )[1][1], -1.0, 'and at -1' );
}

// ---------------------------------------------------------------------------
// fxClamp, which everything above leans on.
// ---------------------------------------------------------------------------
eq( fx.fxClamp( 5, 0, 1 ), 1, 'clamp high' );
eq( fx.fxClamp( -5, 0, 1 ), 0, 'clamp low' );
eq( fx.fxClamp( 0.5, 0, 1 ), 0.5, 'clamp passes what is already inside' );

report( 'normalization' );
