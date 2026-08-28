// Free variables — identifiers a file reads and nothing declares.
//
// node --check only parses. It happily accepts `this.x = styleTip;` when
// styleTip was deleted three edits ago, because that is a runtime
// ReferenceError, not a syntax error. The harness went green and PixInsight
// refused to open the dialog: "line 757: ReferenceError: styleTip is not
// defined". Nothing here would have caught it, and the PJSR files are exactly
// the kind of code where an over-broad search-and-replace leaves a dangling
// reference behind.
//
// This is a scope-less approximation, not a compiler: it collects every
// declaration in a file and flags reads of anything that is neither declared,
// nor a known PixInsight global, nor a known project global. It cannot see
// block scope, which is fine — a name declared anywhere in the file is a name
// that exists, and a name declared nowhere is the bug being hunted.
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const { ok, report } = require( './assert.js' );


/*
 * Blank out strings and comments in one left-to-right pass.
 *
 * Doing it with three independent regexes does not work: a // inside a string
 * literal ends the "comment" in the wrong place, and a quote inside a comment
 * opens a "string" that swallows the rest of the file. The first attempt at
 * this check reported words like "the" and "from" as undeclared identifiers,
 * which is what a broken stripper looks like from the outside.
 */

// Whether a slash at this point opens a regex literal rather than a division.
// Decided by the last meaningful character emitted so far, which is the usual
// approximation and is exact enough for this codebase.
function regexCanStartHere( emitted )
{
   const prev = emitted.replace( /\s+$/, '' ).slice( -1 );
   return prev === '' || '(,=:[!&|?{};+-*%~^<>'.indexOf( prev ) >= 0;
}

function strip( src )
{
   let out = '';
   let i = 0;
   const n = src.length;
   while ( i < n )
   {
      const c = src[i], d = src[i+1];
      if ( c === '/' && d === '*' )
      {
         const end = src.indexOf( '*/', i + 2 );
         const skipped = ( end < 0 ? src.slice( i ) : src.slice( i, end + 2 ) );
         out += skipped.replace( /[^\n]/g, ' ' );
         i = end < 0 ? n : end + 2;
      }
      else if ( c === '/' && d === '/' )
      {
         const end = src.indexOf( '\n', i );
         out += ' '.repeat( ( end < 0 ? n : end ) - i );
         i = end < 0 ? n : end;
      }
      else if ( c === '"' || c === "'" )
      {
         let j = i + 1;
         while ( j < n && src[j] !== c )
            j += ( src[j] === '\\' ? 2 : 1 );
         out += c + c;
         i = Math.min( j + 1, n );
      }
      else if ( c === '/' && regexCanStartHere( out ) )
      {
         // A regex literal. Its character classes read as identifiers otherwise:
         // /win|mswindows/i offered up "win" and "mswindows" as undeclared names.
         let j = i + 1, cls = false;
         while ( j < n )
         {
            const k = src[j];
            if ( k === '\\' ) { j += 2; continue; }
            if ( k === '[' ) cls = true;
            else if ( k === ']' ) cls = false;
            else if ( k === '/' && !cls ) break;
            else if ( k === '\n' ) break;
            j++;
         }
         out += ' '.repeat( Math.min( j + 1, n ) - i );
         i = Math.min( j + 1, n );
      }
      else if ( c === '#' && ( i === 0 || src[i-1] === '\n' ) )
      {
         // A preprocessor line, continued while it ends in a backslash.
         let j = i;
         while ( j < n )
         {
            const eol = src.indexOf( '\n', j );
            if ( eol < 0 ) { j = n; break; }
            if ( src[eol-1] !== '\\' ) { j = eol; break; }
            j = eol + 1;
         }
         out += ' '.repeat( j - i );
         i = j;
      }
      else
      {
         out += c;
         i++;
      }
   }
   return out;
}

const ROOT = path.join( __dirname, '..', 'pjsr' );
const FILES = [ 'ForaxxPaletteStudio.js', 'lib/FXDialog.js', 'lib/FXExpressions.js',
                'lib/FXHistogram.js', 'lib/FXParameters.js', 'lib/FXPreview.js',
                'lib/FXProcessing.js', 'lib/FXSplitter.js', 'lib/FXStrings.js' ];

// PixInsight's own namespace, plus the JavaScript globals PJSR exposes. A name
// missing from here shows up as a false positive, which is the safe direction:
// it gets read, understood and either added or fixed.
const GLOBALS = new Set( [
   // language
   'Array','Boolean','Date','Error','Function','JSON','Math','Number','Object','RegExp',
   'String','isFinite','isNaN','parseFloat','parseInt','undefined','NaN','Infinity',
   'console','module','require','process','this','arguments','TypeError','RangeError',
   // PJSR core
   'Console','Settings','Parameters','File','Dialog','Control','Frame','Label','PushButton',
   'ToolButton','RadioButton','CheckBox','ComboBox','Edit','NumericControl','NumericEdit',
   'Slider','HorizontalSizer','VerticalSizer','SectionBar','GroupBox','ScrollBox','TextBox',
   'Timer','Bitmap','Graphics','Cursor','Font','Brush','Pen','Rect','Point','Sizer',
   'MessageBox','ImageWindow','View','Image','ProcessInstance','Process','CoreApplication',
   'ExternalProcess','Security','DataType_Boolean','DataType_Int32','DataType_Double',
   'DataType_String','StdIcon_Warning','StdIcon_Error','StdIcon_Information','StdIcon_Question',
   'StdButton_Ok','StdButton_Cancel','StdButton_Yes','StdButton_No','StdDialogCode_Ok',
   'StdCursor_Arrow','StdCursor_Wait','StdCursor_PointingHand','StdCursor_OpenHand',
   'StdCursor_ClosedHand','StdCursor_SizeHorizontal','StdCursor_SizeVertical',
   'TextAlign_Left','TextAlign_Right','TextAlign_Center','TextAlign_VertCenter',
   'TextAlign_Top','TextAlign_Bottom','FrameStyle_Box','FrameStyle_Flat','FrameStyle_Sunken',
   'FrameStyle_Raised','FrameStyle_Styled','MouseButton_Left','MouseButton_Right',
   'MouseButton_Middle','KeyModifier_Control','KeyModifier_Shift','KeyModifier_Alt',
   'UndoFlag_NoSwapFile','UndoFlag_PixelData','SampleType_Float','jsAutoGC','format',
   'processEvents','gc','getEnvironmentVariable','uuidgen','msecToString',
   // Process instances the pipeline constructs by name.
   'PixelMath','SCNR','Invert','CurvesTransformation','HistogramTransformation',
   'ChannelExtraction','ChannelCombination','ColorSaturation','UnsharpMask',
   'HDRMultiscaleTransform','LocalHistogramEqualization','IntegerResample','Resample',
   'ViewList','StdCursor_VerticalSplit','StdCursor_HorizontalSplit','__FILE__'
] );

// Names the preprocessor supplies, or that live in another file of the bundle.
const PROJECT = new Set( [ 'TITLE', 'VERSION', 'FX_ICON_NAME', 'FX_SETTINGS_KEY' ] );

// Everything any file declares. Cross-file, because #include makes them one
// translation unit: a function defined in FXProcessing is callable from
// FXDialog, and that is not a bug.
const declared = new Set( [ ...GLOBALS, ...PROJECT ] );
const sources = {};

for ( const f of FILES )
{
   let src = strip( fs.readFileSync( path.join( ROOT, f ), 'utf8' ) );
   sources[f] = src;

   // #define names: the stripper blanks the directive lines, so they have to be
   // harvested from the raw source before it runs.
   {
      const raw = fs.readFileSync( path.join( ROOT, f ), 'utf8' );
      let d;
      const defs = /^\s*#define\s+([A-Za-z_$][\w$]*)/gm;
      while ( ( d = defs.exec( raw ) ) !== null )
         declared.add( d[1] );
   }

   for ( const re of [ /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g,
                       /\bfunction\s+([A-Za-z_$][\w$]*)/g,
                       /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g,
                       /\bfor\s*\(\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g ] )
   {
      let m;
      while ( ( m = re.exec( src ) ) !== null )
         declared.add( m[1] );
   }
   // Function parameters, including the arrow and method forms.
   let m;
   const params = /(?:function\s*[A-Za-z_$][\w$]*\s*|function\s*|=>\s*)?\(([^()]*)\)\s*(?:=>|\{)/g;
   while ( ( m = params.exec( src ) ) !== null )
      m[1].split( ',' ).forEach( a => {
         const n = a.trim().split( /[\s=]/ )[0];
         if ( /^[A-Za-z_$][\w$]*$/.test( n ) ) declared.add( n );
      } );
}

// Now the reads. A bare identifier that is not preceded by a dot and not
// followed by a colon (object literal key) has to resolve to something.
let flagged = 0;
for ( const f of FILES )
{
   const src = sources[f];
   const seen = new Set();
   // Lookbehind, not a consuming prefix: a consumed character made the engine
   // backtrack into the identifier and report truncated names.
   const re = /(?<![.\w$])[A-Za-z_$][\w$]*/g;
   let m;
   while ( ( m = re.exec( src ) ) !== null )
   {
      const name = m[0];
      // An object-literal key, a label, or a property being defined.
      if ( /^\s*:/.test( src.slice( re.lastIndex ) ) ) continue;
      if ( declared.has( name ) || seen.has( name ) ) continue;
      // Fragments of a character class inside a regex literal - "A-Za-z_$" reads
      // as Za and z_ once the dashes are gone. Too short to be a real name.
      if ( name.length <= 2 ) continue;
      // Keywords and object-literal keys the crude regex still lets through.
      if ( /^(if|else|for|while|do|return|new|typeof|instanceof|in|of|delete|void|throw|try|catch|finally|switch|case|default|break|continue|null|true|false|function|var|let|const|this|class|extends|super|yield|await|async|static|get|set)$/.test( name ) )
         continue;
      if ( new RegExp( '\\b' + name + '\\s*:' ).test( src ) ) continue;   // object key
      seen.add( name );
      flagged++;
      ok( false, f + ' reads "' + name + '", which nothing declares' );
   }
}
ok( flagged === 0, 'every identifier the PJSR sources read is declared somewhere' );

report( 'undefined' );
