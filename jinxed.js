(function (
    global, pool, math, width, chunks, digits, module, define, rngname) {

//
// The following constants are related to IEEE 754 limits.
//
var startdenom = math.pow(width, chunks),
    significance = math.pow(2, digits),
    overflow = significance * 2,
    mask = width - 1,
    nodecrypto;

//
// seedrandom()
// This is the seedrandom function described above.
//
var impl = math['seed' + rngname] = function(seed, options, callback) {
  var key = [];
  options = (options == true) ? { entropy: true } : (options || {});

  // Flatten the seed string or build one from local entropy if needed.
  var shortseed = mixkey(flatten(
    options.entropy ? [seed, tostring(pool)] :
    (seed == null) ? autoseed() : seed, 3), key);

  // Use the seed to initialize an ARC4 generator.
  var arc4 = new ARC4(key);

  // Mix the randomness into accumulated entropy.
  mixkey(tostring(arc4.S), pool);

  // Calling convention: what to return as a function of prng, seed, is_math.
  return (options.pass || callback ||
      // If called as a method of Math (Math.seedrandom()), mutate Math.random
      // because that is how seedrandom.js has worked since v1.0.  Otherwise,
      // it is a newer calling convention, so return the prng directly.
      function(prng, seed, is_math_call) {
        if (is_math_call) { math[rngname] = prng; return seed; }
        else return prng;
      })(

  // This function returns a random double in [0, 1) that contains
  // randomness in every bit of the mantissa of the IEEE 754 value.
  function() {
    var n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
        d = startdenom,                 //   and denominator d = 2 ^ 48.
        x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  }, shortseed, 'global' in options ? options.global : (this == math));
};

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
/** @constructor */
function ARC4(key) {
  var t, keylen = key.length,
      me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];

  // The empty key [] is treated as [0].
  if (!keylen) { key = [keylen++]; }

  // Set up S using the standard key scheduling algorithm.
  while (i < width) {
    s[i] = i++;
  }
  for (i = 0; i < width; i++) {
    s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))];
    s[j] = t;
  }

  // The "g" method returns the next (count) outputs as one number.
  (me.g = function(count) {
    // Using instance members instead of closure state nearly doubles speed.
    var t, r = 0,
        i = me.i, j = me.j, s = me.S;
    while (count--) {
      t = s[i = mask & (i + 1)];
      r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))];
    }
    me.i = i; me.j = j;
    return r;
    // For robust unpredictability, the function call below automatically
    // discards an initial batch of values.  This is called RC4-drop[256].
    // See http://google.com/search?q=rsa+fluhrer+response&btnI
  })(width);
}

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
function flatten(obj, depth) {
  var result = [], typ = (typeof obj), prop;
  if (depth && typ == 'object') {
    for (prop in obj) {
      try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
    }
  }
  return (result.length ? result : typ == 'string' ? obj : obj + '\0');
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
function mixkey(seed, key) {
  var stringseed = seed + '', smear, j = 0;
  while (j < stringseed.length) {
    key[mask & j] =
      mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
  }
  return tostring(key);
}

//
// autoseed()
// Returns an object for autoseeding, using window.crypto if available.
//
/** @param {Uint8Array|Navigator=} seed */
function autoseed(seed) {
  try {
    if (nodecrypto) return tostring(nodecrypto.randomBytes(width));
    global.crypto.getRandomValues(seed = new Uint8Array(width));
    return tostring(seed);
  } catch (e) {
    return [+new Date, global, (seed = global.navigator) && seed.plugins,
      global.screen, tostring(pool)];
  }
}

//
// tostring()
// Converts an array of charcodes to a string
//
function tostring(a) {
  return String.fromCharCode.apply(0, a);
}

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to interfere with deterministic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(math[rngname](), pool);

//
// Nodejs and AMD support: export the implementation as a module using
// either convention.
//
if (module && module.exports) {
  module.exports = impl;
  try {
    // When in node.js, try using crypto package for autoseeding.
    nodecrypto = require('crypto');
  } catch (ex) {}
} else if (define && define.amd) {
  define(function() { return impl; });
}

//
// Node.js native crypto support.
//

// End anonymous scope, and pass initial values.
})(
  this,   // global window object
  [],     // pool: entropy pool starts empty
  Math,   // math: package containing random, pow, and seedrandom
  256,    // width: each RC4 output is 0 <= x < 256
  6,      // chunks: at least six RC4 outputs for each double
  52,     // digits: there are 52 significant digits in a double
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define,  // present with an AMD loader
  'random'// rngname: name for Math.random and Math.seedrandom
);

function qs(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

var LIVES = 3;

var WIDTH = parseInt(qs('w'));
if(!WIDTH) {
    WIDTH = 30;
}

var HEIGHT = parseInt(qs('h'));
if(!HEIGHT) {
    HEIGHT = 30;
}

var SEED = qs('s');
if(!SEED) {
    SEED = String(Math.floor(Math.random() * 1000000));
}

var MINE_COUNT = parseInt(qs('c'));
if(!MINE_COUNT) {
    var MINE_DENSITY = 0.16;
    MINE_COUNT = Math.floor((WIDTH * HEIGHT) * MINE_DENSITY);
}

// Globals
var bomb;
var visible;
var gameover = 0; // 1 = lose, 2 = win

function rand(x)
{
    return Math.floor(Math.random() * x);
}

function neighbors(i, j, unflaggedOnly)
{
    var n = 0;
    var x1 = Math.max(i - 1, 0);
    var x2 = Math.min(WIDTH - 1, i + 1);
    var y1 = Math.max(j - 1, 0);
    var y2 = Math.min(HEIGHT - 1, j + 1);
    for(var x = x1; x <= x2; ++x)
    {
        for(var y = y1; y <= y2; ++y)
        {
            if((x != i) || (y != j))
            {
                if(!unflaggedOnly || (visible[x + (y * WIDTH)] == 0))
                {
                    if(bomb[x + (y * WIDTH)] == 1)
                    {
                        ++n;
                    }
                }
            }
        }
    }
    return n;
}

function hasVisibleZeroNeighbor(i, j)
{
    var x1 = Math.max(i - 1, 0);
    var x2 = Math.min(WIDTH - 1, i + 1);
    var y1 = Math.max(j - 1, 0);
    var y2 = Math.min(HEIGHT - 1, j + 1);
    for(var x = x1; x <= x2; ++x)
    {
        for(var y = y1; y <= y2; ++y)
        {
            if((x != i) || (y != j))
            {
                if(visible[x + (y * WIDTH)] != 0)
                {
                    var n = neighbors(x, y, false);
                    if(n == 0)
                    {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// returns true if this is game over
function loseLife()
{
    --LIVES;
    if(LIVES > 0) {
        $('#winlose').html("Are you suuuuure? ("+LIVES+" left)");
        return false;
    }
    return true;
}

function checkWin()
{
    for(var i = 0; i < WIDTH * HEIGHT; ++i)
    {
        //if(bomb[i] != 1)
        {
            if(visible[i] == 0)
            {
                return;
            }
        }
    }

    $('#winlose').html("You win!");
    gameover = 1;
}

function poke(i, j)
{
    var ret = 0;
    var index = i + (j * WIDTH);
    if(visible[index] == 0)
    {
        if(bomb[index] == 1)
        {
            // Bad spot; lose the game
            if(loseLife()) {
                visible[index] = 2;
                gameover = 1;
                $('#winlose').html("BOMB! You lose!");
                updateAll(true);
                return false;
            } else {
                return 0;
            }
        }

        visible[index] = 1;
        ret = 1;
    }
    return ret;
}

function flag(i, j)
{
    var index = i + (j * WIDTH);
    if(visible[index] == 0)
    {
        if(bomb[index] == 1)
        {
            //bomb[index] = 0;
            //poke(i, j);
            visible[index] = 1;
        }
        else
        {
            // Bad flag; lose the game
            if(loseLife()) {
                visible[index] = 2;
                updateAll(true);
                gameover = 1;
                $('#winlose').html("BAD FLAG! You lose!");
                return;
            }
        }

    }
}

function onCellClick(i, j, right)
{
    $('#winlose').html("");

    if(gameover == 0)
    {
        if(right)
        {
            flag(i, j);
        }
        else
        {
            poke(i, j);
        }
        updateAll(false);
        checkWin();
    }
}

function updateCell(i, j, reveal)
{
    var image = "images/blank.gif";
    var index = i + (j * WIDTH);
    var isBomb = bomb[index];
    var isVisible = visible[index];
    var n = neighbors(i, j, false);

    if(isVisible == 0)
    {
        if(reveal)
        {
            if(isBomb == 1)
            {
                image = "images/bombrevealed.gif";
            }
            else
            {
                image = "images/shadow"+n+".gif";
            }
        }
        else
        {
            image = "images/blank.gif";
        }
    }
    else
    {
        if(isBomb == 1)
        {
            if(isVisible == 2)
            {
                image = "images/bombdeath.gif";
            }
            else
            {
                var unflagged = neighbors(i, j, true);
                if(unflagged == 0)
                {
                    n = 0;
                }
                image = "images/bomb"+n+".gif";
            }
        }
        else
        {
            if(isVisible == 2)
            {
                image = "images/bombmisflagged.gif";
            }
            else
            {
                image = "images/open"+n+".gif";
            }
        }
    }

    $("#cell"+i+"x"+j).attr("src", image);
}

function updateAll(reveal)
{
    var keepGoing = true;
    while(keepGoing)
    {
        keepGoing = false;

        for(var j = 0; j < HEIGHT; ++j)
        {
            for(var i = 0; i < WIDTH; ++i)
            {
                if((bomb[i + (j * WIDTH)] == 0) && hasVisibleZeroNeighbor(i, j))
                {
                    if(poke(i, j))
                    {
                        keepGoing = true;
                    }
                }
            }
        }
    }

    for(var j = 0; j < HEIGHT; ++j)
    {
        for(var i = 0; i < WIDTH; ++i)
        {
            updateCell(i, j, reveal);
        }
    }
}

function firstClickIsFree()
{
    var cellCount = WIDTH * HEIGHT;
    var startIndex = rand(cellCount);
    var index = startIndex;
    while(1)
    {
        var i = Math.floor(index % WIDTH);
        var j = Math.floor(index / WIDTH);
        var n = neighbors(i, j, false);
        if((bomb[index] == 0) && (n == 0))
        {
            poke(i, j);
            return;
        }

        index = (index + 1) % cellCount;
        if(index == startIndex) {
            break;
        }
    }

    while(1)
    {
        var i = Math.floor(index % WIDTH);
        var j = Math.floor(index / WIDTH);
        var n = neighbors(i, j, false);
        if((bomb[index] == 0))
        {
            poke(i, j);
            return;
        }

        index = (index + 1) % cellCount;
        if(index == startIndex) {
            break;
        }
    }
}

function newGame()
{
    Math.seedrandom(SEED);

    var n;

    // Create fresh arrays
    bomb = new Array(WIDTH * HEIGHT).fill(0);
    visible = new Array(WIDTH * HEIGHT).fill(0);

    // Drop in the mines randomly
    var cellCount = WIDTH * HEIGHT;
    var indices = new Array(cellCount);
    indices[0] = 0;
    for(var i = 1; i < cellCount; ++i) {
        var j = Math.floor(Math.random() * i);
        indices[i] = indices[j];
        indices[j] = i;
    }

    var m = MINE_COUNT;
    if(m >= cellCount) {
        m = cellCount - 1;
    }
    for(var i = 0; i < m; ++i) {
        bomb[indices[i]] = 1;
    }

    firstClickIsFree();
    updateAll(false);
}

function init()
{
    var board = "";
    for(var j = 0; j < HEIGHT; ++j)
    {
        for(var i = 0; i < WIDTH; ++i)
        {
            board += "<img class=\"cell\" id=\"cell"+i+"x"+j+"\" onclick=\"onCellClick("+i+", "+j+", false)\" oncontextmenu=\"onCellClick("+i+", "+j+", true); return false;\" src=\"images/bombrevealed.gif\">";
        }
        board += "<br>";
    }
    $('#board').html(board);

    var links = "";
    links += "[<a href=\"?w="+WIDTH+"&h="+HEIGHT+"&c="+MINE_COUNT+"&s="+SEED+"\">Reset</a>] ";
    links += "[<a href=\"?w="+WIDTH+"&h="+HEIGHT+"&c="+MINE_COUNT+"\">New</a>] ";
    links += "[<a href=\"?w=8&h=8&c=10\">Beginner</a>] ";
    links += "[<a href=\"?w=16&h=16&c=40\">Intermediate</a>] ";
    links += "[<a href=\"?w=30&h=16&c=99\">Expert</a>] ";
    links += "[<a href=\"?w=30&h=30&c=200\">LOL</a>] ";
    $('#links').html(links);

    newGame();


    $('#links').html(links);

    newGame();
}

$(document).ready(init);
