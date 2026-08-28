// Minimal assertion helper shared by the suites.
//
// The exit handler is the load-bearing part. Failures used to reach the runner
// only through report(), so a suite that forgot to call it could not fail: a
// broken assertion printed nothing and the runner said "All tests passed". A
// test harness whose silence is indistinguishable from success is worse than no
// harness, because it is trusted. Both routes to a non-zero status are now
// automatic, and a suite that ends without reporting is itself a failure.
'use strict';

let failed = 0;
let passed = 0;
let reported = false;

function eq( actual, expected, what )
{
   if ( actual === expected ) { passed++; return; }
   failed++;
   console.error( 'FAIL ' + what + '\n  expected: ' + JSON.stringify( expected )
                + '\n  actual:   ' + JSON.stringify( actual ) );
}

function ok( cond, what )
{
   if ( cond ) { passed++; return; }
   failed++;
   console.error( 'FAIL ' + what );
}

// Floating point comparison. Default tolerance is loose enough for the MTF
// solver's own convergence and tight enough that a real regression shows.
function near( actual, expected, what, tol )
{
   tol = ( tol === undefined ) ? 1e-9 : tol;
   if ( Math.abs( actual - expected ) <= tol ) { passed++; return; }
   failed++;
   console.error( 'FAIL ' + what + '\n  expected: ' + expected + ' ±' + tol
                + '\n  actual:   ' + actual );
}

function report( suite )
{
   reported = true;
   if ( failed )
   {
      console.error( suite + ': ' + failed + ' of ' + ( failed + passed ) + ' assertions failed.' );
      process.exitCode = 1;
      return;
   }
   console.log( suite + ': ' + passed + ' assertions passed.' );
}

// The backstop. Runs however the suite ends — a normal return, an early return,
// a deleted report() call.
process.on( 'exit', function ( code )
{
   if ( code !== 0 || process.exitCode )
      return;                              // already failing; say nothing twice
   if ( failed > 0 )
   {
      console.error( failed + ' assertion(s) failed and the suite ended without reporting them.' );
      process.exitCode = 1;
   }
   else if ( !reported )
   {
      console.error( 'This suite ended without calling report(). A suite that does not '
                   + 'report cannot fail, so not reporting is itself the failure.' );
      process.exitCode = 1;
   }
} );

module.exports = { eq, ok, near, report };
