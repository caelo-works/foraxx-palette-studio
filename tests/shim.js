// ---- PixInsight globals the bundled libraries touch ----
//
// Only what FXParameters, FXExpressions and FXProcessing actually reach for at
// the level the harness drives them. Anything deeper than this is a PI-facing
// path and belongs in the hand gates, not here.

// PixInsight's printf. The expression builders lean on it for every numeric
// literal they emit, so the shim has to round exactly as C does — a shim that
// formatted differently would make the tests agree with themselves and with
// nothing else.
function format( fmt )
{
   var args = Array.prototype.slice.call( arguments, 1 );
   // PixInsight accepts format( fmt, [a, b, c] ) as well as varargs.
   if ( args.length === 1 && Array.isArray( args[0] ) )
      args = args[0];
   var i = 0;
   // Flags, width, precision, conversion. The zero flag matters: identifiers are
   // built with "%02d", and space padding there would produce "Foraxx 1".
   return fmt.replace( /%([-+0 ]*)(\d+)?(?:\.(\d+))?([dfsge])/g,
      function ( _, flags, width, prec, conv )
      {
         var v = args[i++], out, neg = false;
         switch ( conv )
         {
         case 'd': out = String( Math.round( Number( v ) ) ); break;
         case 'f': out = Number( v ).toFixed( prec === undefined ? 6 : Number( prec ) ); break;
         case 'e': out = Number( v ).toExponential( prec === undefined ? 6 : Number( prec ) ); break;
         case 'g': out = String( Number( v ) ); break;
         default:  out = String( v );
         }
         if ( conv !== 's' && flags.indexOf( '+' ) >= 0 && Number( v ) >= 0 )
            out = '+' + out;
         if ( width )
         {
            var w = Number( width );
            var left = flags.indexOf( '-' ) >= 0;
            var zero = flags.indexOf( '0' ) >= 0 && !left && conv !== 's';
            // A zero-padded negative number keeps its sign in front of the zeros.
            if ( zero && out.charAt( 0 ) === '-' ) { neg = true; out = out.slice( 1 ); w -= 1; }
            while ( out.length < w )
               out = left ? out + ' ' : ( zero ? '0' : ' ' ) + out;
            if ( neg )
               out = '-' + out;
         }
         return out;
      } );
}

// The console. Warnings are captured rather than discarded: several of them are
// the only thing that tells a user why an image came out wrong, so the tests
// assert on them.
var __fxConsole = { warnings: [], notes: [], errors: [] };
var Console = {
   write:       function () {},
   writeln:     function () {},
   noteln:      function ( s ) { __fxConsole.notes.push( String( s ) ); },
   warningln:   function ( s ) { __fxConsole.warnings.push( String( s ) ); },
   criticalln:  function ( s ) { __fxConsole.errors.push( String( s ) ); },
   show:        function () {},
   hide:        function () {},
   flush:       function () {},
   abortEnabled: false,
   abortRequested: false
};
function fxTestConsoleReset()
{
   __fxConsole.warnings = [];
   __fxConsole.notes = [];
   __fxConsole.errors = [];
}
function fxTestConsole() { return __fxConsole; }

// A view registry, so the identifier helpers can be driven without PixInsight.
// fxViewExists is the only thing that reads it.
var __fxViews = {};
var View = {
   viewById: function ( id )
   {
      return __fxViews[id] ? { id: id, isNull: false } : { id: '', isNull: true };
   }
};
var ImageWindow = {
   windowById: function () { return { isNull: true }; }
};
function fxTestSetViews( ids )
{
   __fxViews = {};
   ( ids || [] ).forEach( function ( id ) { __fxViews[id] = true; } );
}

// A stand-in for a single-channel view, driven by plain statistics. This is what
// lets the normalization maths be tested on data whose median and MAD are known
// exactly, linear or stretched.
function fxTestView( id, stats )
{
   return {
      id: id,
      isNull: false,
      image: {
         median:  function () { return stats.median; },
         MAD:     function () { return ( stats.madn === undefined ? stats.median / 4 : stats.madn ) / 1.4826; },
         stdDev:  function () { return stats.madn === undefined ? stats.median / 4 : stats.madn; },
         minimum: function () { return stats.minimum === undefined ? 0 : stats.minimum; }
      }
   };
}

// ---- Process stand-ins ----
//
// Enough of PixelMath, HDRMultiscaleTransform and UnsharpMask to drive the
// wrappers that decide sample format and report what ran. Each instance records
// what was set on it, and each constructor can be made to throw, which is the
// only way to reach the "not in this installation" branches from here.

var __fxProcessLog = [];
var __fxProcessFail = {};   // name -> "construct" | "execute"

function fxTestProcessReset()
{
   __fxProcessLog = [];
   __fxProcessFail = {};
}
function fxTestProcessLog() { return __fxProcessLog; }
function fxTestProcessFail( name, when ) { __fxProcessFail[name] = when; }
function fxTestLastProcess( name )
{
   for ( var i = __fxProcessLog.length - 1; i >= 0; --i )
      if ( __fxProcessLog[i].name === name )
         return __fxProcessLog[i];
   return null;
}

function __fxMakeProcess( name )
{
   function P()
   {
      if ( __fxProcessFail[name] === 'construct' )
         throw new Error( name + ' is not installed' );
      this.name = name;
      this.executed = false;
      __fxProcessLog.push( this );
   }
   P.prototype.executeOn = function ()
   {
      if ( __fxProcessFail[name] === 'execute' )
         throw new Error( name + ' refused this image' );
      this.executed = true;
      return true;
   };
   return P;
}

var PixelMath = __fxMakeProcess( 'PixelMath' );
// The sample format enumerators, as distinguishable values rather than the
// integers PixInsight uses: a test that asserts on them should fail loudly if
// the wrapper ever picks the wrong one.
PixelMath.prototype.f32 = 'f32';
PixelMath.prototype.f64 = 'f64';
PixelMath.prototype.SameAsTarget = 'SameAsTarget';
PixelMath.prototype.RGB = 'RGB';
PixelMath.prototype.Gray = 'Gray';

var HDRMultiscaleTransform = __fxMakeProcess( 'HDRMultiscaleTransform' );
var UnsharpMask = __fxMakeProcess( 'UnsharpMask' );

// Lets a test take the 32-bit enumerator away without touching the wrapper.
function fxTestSampleFormats( formats )
{
   delete PixelMath.prototype.f32;
   delete PixelMath.prototype.f64;
   if ( formats.f32 ) PixelMath.prototype.f32 = 'f32';
   if ( formats.f64 ) PixelMath.prototype.f64 = 'f64';
   __fxSampleFormatWarned = false;
}
