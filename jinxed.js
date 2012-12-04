var MINE_DENSITY = 0.16;

var WIDTH = 30;
var HEIGHT = 30;
var MINE_COUNT = (WIDTH * HEIGHT) * MINE_DENSITY;

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

function checkWin()
{
//    for(var i = 0; i < WIDTH * HEIGHT; ++i)
//    {
//        if(bomb[i] != 1)
//        {
//            if(visible[i] == 0)
//            {
//                return;
//            }
//        }
//    }
//
//    console.log("you win!");
    //gameover = 1;
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
            visible[index] = 2;
            gameover = 1;
            updateAll(true);
            return false;
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
            visible[index] = 2;
            updateAll(true);
            gameover = 1;
            return;
        }

    }
}

function onCellClick(i, j, right)
{
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
    while(1)
    {
        var i = rand(WIDTH);
        var j = rand(HEIGHT);
        var index = i + (j * WIDTH);
        var n = neighbors(i, j, false);
        if((bomb[index] == 0) && (n == 0))
        {
            poke(i, j);
            break;
        }
    }
}

function newGame()
{
    var n;

    // Create fresh arrays
    bomb = new Array();
    visible = new Array();

    // Fill fresh arrays with a bunch of zeros
    n = 0;
    for(var j = 0; j < HEIGHT; ++j)
    {
        for(var i = 0; i < WIDTH; ++i)
        {
            bomb[n] = 0;
            visible[n] = 0;
            ++n;
        }
    }

    // Drop in the mines randomly
    var m = MINE_COUNT;
    while(m > 0)
    {
        var index = rand(WIDTH * HEIGHT);
        if(bomb[index] == 0)
        {
            bomb[index] = 1;
            --m;
        }
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

    newGame();
}

$(document).ready(init);
