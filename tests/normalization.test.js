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
// 3.0.0 withdrew linear support; this restores it. The reference frames are the
// six real masters in testset/, measured over 200k pixels each - the nebula
// channels sit at 3e-3 to 7e-3 and the star frames some 2000x below that,
// because a star frame is almost entirely empty background.
//
// Two failures are pinned here, both of which shipped once.
// ---------------------------------------------------------------------------
const MASTERS = {
   sii:  { median: 3.290e-3, madn: 2.931e-4, minimum: 2.393e-3 },
   ha:   { median: 7.062e-3, madn: 1.978e-3, minimum: 3.832e-3 },
   oiii: { median: 5.716e-3, madn: 2.353e-4, minimum: 4.880e-3 },
   siiStars:  { median: 8.610e-6, madn: 1.072e-5, minimum: 1.553e-7 },
   haStars:   { median: 3.194e-6, madn: 3.409e-6, minimum: 0 },
   oiiiStars: { median: 2.482e-6, madn: 2.866e-6, minimum: 1.420e-7 }
};
const LINEAR = over => P( Object.assign( {
   linearInput: true, linearMethod: 1, linearTarget: 0.25, linearClip: 2.80, linearNoClip: false
}, over ) );
const master = ( id, k ) => fx.fxTestView( id, MASTERS[k] );
const applied = ( t, x ) => fx.fxMTFValue( t.m, ( x - t.c0 ) / ( 1 - t.c0 ) );

// Nothing at all happens while the switch is off. Linear support must be
// strictly additive: the parity promise is that Foraxx classic at defaults
// still produces the original's starless image bit for bit.
{
   fx.fxClearStatsCache();
   eq( fx.fxStretchMapFor( P( {} ), master( 'a', 'sii' ), master( 'b', 'ha' ), master( 'c', 'oiii' ) ),
       null, 'with the auto stretch off and normalization off, nothing is conditioned' );
}

// The auto stretch alone puts every channel on the requested background.
{
   fx.fxClearStatsCache();
   const p = LINEAR();
   const map = fx.fxStretchMapFor( p, master( 'S', 'sii' ), master( 'H', 'ha' ), master( 'O', 'oiii' ) );
   ok( map != null, 'the auto stretch produces a transform map' );
   [ [ 'sii', 'sii' ], [ 'ha', 'ha' ], [ 'oiii', 'oiii' ] ].forEach( ( [ key, k ] ) => {
      near( applied( map[key], MASTERS[k].median ), 0.25,
            key + ' lands on the requested background, not on a clamp', 1e-4 );
   } );

   // Every balance stays well clear of the emission floor, so fxNum writes it
   // with its significant figures intact. This is the 2.3.4 fault, and it is
   // the reason the target may not be relative.
   [ 'sii', 'ha', 'oiii' ].forEach( key => {
      ok( map[key].m > 1e-5, key + ' balance is far above the 1e-8 floor: ' + map[key].m );
      ok( Number( fx.fxNum( map[key].m ) ) / map[key].m > 0.999,
          key + ' balance survives being written into an expression' );
   } );
}

// The auto stretch and Channel normalization COMPOSE. They used to exclude each
// other: ticking normalization on linear data replaced the absolute target with
// the reference channel's raw linear median, and the result came out 250x
// darker than either setting alone. That is 2.3.4(b), and this is its guard.
{
   fx.fxClearStatsCache();
   const p = LINEAR( { normalizeEnabled: true, normalizeRef: 1,
                       normSii: 1, normHa: 1, normOiii: 1, normShadow: 0.25 } );
   const map = fx.fxStretchMapFor( p, master( 'S2', 'sii' ), master( 'H2', 'ha' ), master( 'O2', 'oiii' ) );
   [ [ 'sii', 'sii' ], [ 'ha', 'ha' ], [ 'oiii', 'oiii' ] ].forEach( ( [ key, k ] ) => {
      near( applied( map[key], MASTERS[k].median ), 0.25,
            key + ' still lands on 0.25 with normalization on as well', 1e-4 );
   } );

   fx.fxClearStatsCache();
   const q = LINEAR( { normalizeEnabled: true, normalizeRef: 1,
                       normSii: 1, normHa: 1, normOiii: 0.8, normShadow: 0.25 } );
   const m2 = fx.fxStretchMapFor( q, master( 'S3', 'sii' ), master( 'H3', 'ha' ), master( 'O3', 'oiii' ) );
   near( applied( m2.oiii, MASTERS.oiii.median ), 0.25 * 0.8,
         'a per-channel boost is relative to the absolute target', 1e-4 );
   near( applied( m2.ha, MASTERS.ha.median ), 0.25,
         'and leaves the unboosted channels where they were', 1e-4 );
}

// Normalization ALONE still cannot stretch. It is a relative statement, so on
// linear data it follows the reference channel down - which is exactly why the
// absolute target had to come back rather than being emulated.
{
   fx.fxClearStatsCache();
   const p = P( { normalizeEnabled: true, normalizeRef: 1,
                  normSii: 1, normHa: 1, normOiii: 1, normShadow: 0.25 } );
   const map = fx.fxStretchMapFor( p, master( 'S4', 'sii' ), master( 'H4', 'ha' ), master( 'O4', 'oiii' ) );
   [ [ 'sii', 'sii' ], [ 'ha', 'ha' ], [ 'oiii', 'oiii' ] ].forEach( ( [ key, k ] ) => {
      ok( applied( map[key], MASTERS[k].median ) < 0.01,
          key + ' stays black under normalization alone' );
   } );
}

// The star frames. This is 2.6.1, and it is the failure that made the whole
// feature look unsalvageable: a star frame's median IS its empty background, so
// solving it its own stretch puts the void on the target and saturates every
// star. The curve comes from the nebula; only the black point is per frame.
{
   fx.fxClearStatsCache();
   const p = LINEAR( {
      makeStars: true,
      siiView: master( 'S5', 'sii' ), haView: master( 'H5', 'ha' ), oiiiView: master( 'O5', 'oiii' ),
      siiStarsView: master( 'Ss', 'siiStars' ), haStarsView: master( 'Hs', 'haStars' ),
      oiiiStarsView: master( 'Os', 'oiiiStars' )
   } );
   const neb = fx.fxCollectStretch( p, false );
   const st  = fx.fxCollectStretch( p, true );

   ok( neb != null && st != null, 'both sets are collected' );
   [ 'sii', 'ha', 'oiii' ].forEach( k =>
      eq( st[k].m, neb[k].m, k + ' star frame shares the nebula midtones curve' ) );
   ok( st.ha.c0 !== neb.ha.c0, 'but keeps its own black point' );

   // The void stays a void.
   ok( applied( st.ha, MASTERS.haStars.median ) < 0.01,
       'the empty background of the star frame stays black' );
   // And the stars keep their range rather than all saturating.
   const faint = applied( st.ha, 1e-3 ), core = applied( st.ha, 0.5 );
   ok( faint > 0.01 && faint < 0.5, 'a faint star is lifted but not blown: ' + faint.toFixed( 3 ) );
   ok( core > 0.9, 'a bright core reaches the highlights: ' + core.toFixed( 3 ) );
   ok( core - faint > 0.5, 'the star field keeps its dynamic range' );

   // The screen combination cannot go below the brighter input, so a lifted
   // star background becomes a grey floor over the whole image. 2.6.1 measured
   // 0.4375 here; the nebula's own level is what it should be.
   const bgNeb = applied( neb.ha, MASTERS.ha.median );
   const bgSt  = applied( st.ha, MASTERS.haStars.median );
   const combined = 1 - ( 1 - bgNeb ) * ( 1 - bgSt );
   near( combined, 0.25, 'the combined background is the nebula\'s, not a grey floor', 0.01 );
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

// ---------------------------------------------------------------------------
// GeneralizedHyperbolicStretch, the third method.
//
// It is a process rather than an expression, so it cannot be folded into the
// combination the way a black point and a midtones balance can. What is
// asserted here is the consequence: with GHS selected the expression carries no
// stretch of its own, because the channels are conditioned into copies before
// it runs. Both together would stretch twice.
// ---------------------------------------------------------------------------
{
   const GHS = over => P( Object.assign( { linearInput: true, linearMethod: 2 }, over ) );

   fx.fxClearStatsCache();
   eq( fx.fxConditionsChannels( GHS() ), false,
       'GHS alone puts no transform in the expression - the process has already run' );
   eq( fx.fxStretchMapFor( GHS(), master( 'g1', 'sii' ), master( 'g2', 'ha' ), master( 'g3', 'oiii' ) ),
       null, 'and no map is produced' );

   // Normalization still applies, and by then it is measuring what GHS
   // produced: the caller points it at the conditioned copies.
   ok( fx.fxConditionsChannels( GHS( { normalizeEnabled: true } ) ),
       'normalization after GHS still conditions through the expression' );

   // The two expression methods are unaffected.
   ok( fx.fxConditionsChannels( P( { linearInput: true, linearMethod: 0 } ) ),
       'the screen transfer method conditions through the expression' );
   ok( fx.fxConditionsChannels( P( { linearInput: true, linearMethod: 1 } ) ),
       'and so does the statistical stretch' );
   eq( fx.fxConditionsChannels( P( {} ) ), false,
       'and nothing conditions anything with the auto stretch off' );

   // The absolute target belongs to the two expression methods only. Under GHS
   // there is nothing for it to mean, and leaving it in force would stretch a
   // second time on top of the process.
   fx.fxClearStatsCache();
   const both = GHS( { normalizeEnabled: true, normalizeRef: 1,
                       normSii: 1, normHa: 1, normOiii: 1, normShadow: 0.25,
                       linearTarget: 0.25 } );
   const map = fx.fxStretchMapFor( both, master( 'g4', 'sii' ), master( 'g5', 'ha' ), master( 'g6', 'oiii' ) );
   ok( map != null, 'GHS with normalization does produce a map' );
   // Relative, not absolute: the reference channel is left where GHS put it.
   near( map.ha.m, 0.5, 'the reference channel is untouched by the normalization step', 1e-9 );

   // The symmetry point follows each channel's own background when automatic,
   // and is a fixed value when it is not.
   fx.fxClearStatsCache();
   [ [ 'sii', 'sii' ], [ 'ha', 'ha' ], [ 'oiii', 'oiii' ] ].forEach( ( [ tag, k ] ) => {
      const sp = fx.fxGhsSymmetryFor( master( 'sp_' + tag, k ), GHS( { ghsAutoSP: true } ) );
      near( sp, MASTERS[k].median, tag + ' pivots on its own median', 1e-9 );
   } );
   eq( fx.fxGhsSymmetryFor( master( 'spm', 'ha' ), GHS( { ghsAutoSP: false, ghsSP: 0.1 } ) ), 0.1,
       'a hand-placed symmetry point is used as given' );
   eq( fx.fxGhsSymmetryFor( null, GHS( { ghsAutoSP: true, ghsSP: 0.1 } ) ), 0.1,
       'and a missing view falls back to it rather than throwing' );
}

// ---------------------------------------------------------------------------
// The symmetry point has to sit at or below the background.
//
// GHS compresses everything below SP towards black. With SP above the data, a
// stronger stretch makes the channel DARKER - and a solver that assumes
// otherwise walks to the worst value it can reach. Measured on the reference
// masters with SP left at its stored 0.10 against a background of 0.003: the
// search settled on D = 9.96 and a median of exactly zero.
// ---------------------------------------------------------------------------
{
   fx.fxClearStatsCache();
   [ [ 'sii', 'sii' ], [ 'ha', 'ha' ], [ 'oiii', 'oiii' ] ].forEach( ( [ tag, k ] ) => {
      const auto = fx.fxGhsAutoSymmetry( master( 'auto_' + tag, k ) );
      near( auto, MASTERS[k].median, tag + ' seeds its symmetry point from its own background' );
      ok( auto <= MASTERS[k].median + 1e-12,
          tag + ' symmetry point is not above the background it pivots on' );
   } );

   eq( fx.fxGhsAutoSymmetry( null ), 0.1,
       'with no view there is nothing to measure, so the stored value stands' );

   // The stored default alone is thirty times above linear data, which is
   // exactly the state that produced a black channel. Unticking the automatic
   // placement seeds this value instead of leaving it there.
   ok( fx.FX.ghsSP > MASTERS.ha.median * 5,
       'the stored symmetry point is far above linear data - hence the seeding' );
}

report( 'normalization' );
