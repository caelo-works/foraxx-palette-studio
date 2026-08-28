// Minimal assertion helper shared by the suites. Every failure is reported with
// what was expected, and the process exits non-zero if any failed — tests/run.sh
// keys off that exit code.
'use strict';

let failed = 0;
let passed = 0;

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
   if ( failed )
   {
      console.error( suite + ': ' + failed + ' of ' + ( failed + passed ) + ' assertions failed.' );
      process.exit( 1 );
   }
   console.log( suite + ': ' + passed + ' assertions passed.' );
}

module.exports = { eq, ok, near, report };
