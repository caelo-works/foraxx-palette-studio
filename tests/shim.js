// ---- PixInsight globals the pure-logic libs touch ----
//
// Only what FXParameters and FXExpressions actually call. format() is
// PixInsight's printf; the expression builders lean on it for every numeric
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
   return fmt.replace( /%(-)?(\d+)?(?:\.(\d+))?([dfsge])/g,
      function ( _, left, width, prec, conv )
      {
         var v = args[i++], out;
         switch ( conv )
         {
         case 'd': out = String( Math.round( Number( v ) ) ); break;
         case 'f': out = Number( v ).toFixed( prec === undefined ? 6 : Number( prec ) ); break;
         case 'e': out = Number( v ).toExponential( prec === undefined ? 6 : Number( prec ) ); break;
         case 'g': out = String( Number( v ) ); break;
         default:  out = String( v );
         }
         if ( width )
         {
            var w = Number( width );
            while ( out.length < w )
               out = left ? out + ' ' : ' ' + out;
         }
         return out;
      } );
}
