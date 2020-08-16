var logger = require('../util/logger.js');
var config = require('../config.json');

/* 
matchExt HANDLERS:
    matchOk => handleJoinMatchOk
    rotatePlayer => handleRotatePlayer
    movePlayer => handleMovePlayer
*/

/*
matchExt RESPONSES:
    matchStarted => respond with an object, consisting of all players
    leaveMatch => the user is forced to leave to lobby
    matchFail => everybody has left the match
    playerLeft => respond with the player id that left
    startMatch => match starts with the parameters given
    focusedPlayer => id of focused player
    playerRotated => respond with the rotation parameter for the given player
    playerMoved => respond with the new x, y and rotation for the given player
*/

//!! IMPORTANT !! only the connected array from the match object is to be used in matchExt as not all players could have joined

function handleMatchPacket(io, player, requestType, args)
{
    switch(requestType)
    {
        case "matchOk":
            handleJoinMatchOk(player);
            break;
        case "rotatePlayer":
            handleRotatePlayer(player, args);
            break;
        case "movePlayer":
            handleMovePlayer(io, player, args);
            break;
        default:
            logger.log("Invalid matchExt handler: " + requestType, 'w');
            break;
    }
}

async function startMatch(io, matchId)
{
    global.matches[matchId].started = true;
    await new Promise(resolve => setTimeout(resolve, config.gameConfig.timeToWaitBeforeMatch));
    for(var player in global.matches[matchId].players)
    {
        var socket = global.matches[matchId].players[player];
        if(global.matches[matchId].connected.indexOf(socket) === -1)
            socket.emit("matchExt", "leaveMatch");
    }

    global.matches[matchId].connectionsCheckPassed = true;

    if(global.matches[matchId].connected.length < config.gameConfig.minPlayersPerMatch)
    {
        for(var socket in global.matches[matchId].connected)
            global.matches[matchId].connected[socket].emit("matchExt", "matchFail");
        global.matches[matchId].started = false;
        global.matches[matchId].failed = true;
        if(!global.matches[matchId].connected.length && !global.matches[matchId].players.length)
            delete global.matches[matchId];
        return;
    }

    //fill obstaclesObject, spawnablesObject

    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = await getPlayerBySocket(playerSocket);
        if(player)
        {
            //when generating coordinates, check if they overlap with anything else before in a do/while
            var x = integerInInterval(0, config.gameConfig.gameWidth);
            var y = integerInInterval(0, config.gameConfig.gameHeight);
            global.matches[matchId].playersObject[player.id] = {character: player.playerData.character, x: x, y: y, rotation: 0};
            player.socket.emit("matchExt", "focusedPlayer", [player.id]);
        }
        else
            global.matches[matchId].connected[socket].emit("matchExt", "matchFail");
    }
    
    io.to(String(matchId)).emit("matchExt", "startMatch", [config.gameConfig.cameraBoundX, config.gameConfig.cameraBoundY, global.matches[matchId].playersObject, global.matches[matchId].obstaclesObject, global.matches[matchId].spawnablesObject, config.gameConfig.gameWidth, config.gameConfig.gameHeight]);
}

async function getPlayerBySocket(socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket === socket)
            return global.players[player];
    }
    return null;
}

function handleJoinMatchOk(player)
{
    if(global.matches[player.matchId].players.indexOf(player.socket) !== -1 && global.matches[player.matchId].connected.indexOf(player.socket) === -1)
        global.matches[player.matchId].connected.push(player.socket);
}

function playerLeft(io, player)
{
    if(!global.matches[player.matchId].connected.length && !global.matches[player.matchId].players.length && global.matches[player.matchId].connectionsCheckPassed)
    { 
        delete global.matches[player.matchId];
        return;
    }

    if(global.matches[player.matchId].connected.length)
    {
        io.to(String(player.matchId)).emit("matchExt", "playerLeft", [player.id]);
        //checks for how many people left etc
        //REMEMBER THE PLAYER HAS ALREADY BEEN REMOVED FROM THE ROOM, BUT THE OTHERS HAVE TO REMOVE HIM TOO
    }
}

function handleRotatePlayer(player, args)
{
    if(Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        global.matches[player.matchId].playersObject[player.id].rotation = args[0];
        player.socket.to(String(player.matchId)).emit("matchExt", "playerRotated", [player.id, args[0]]);
    }
}

function handleMovePlayer(io, player, args)
{
    var now = new Date().valueOf();
    var fps = 1000 / args[1];
    if(args[1] > 60)
        fps = 1000 / 60;
    if((now - player.lastActions.lastMoved) > fps && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        var xCalculations = Math.round(config.gameConfig.playerSpeed * Math.cos(global.matches[player.matchId].playersObject[player.id].rotation));
        var yCalculations = Math.round(config.gameConfig.playerSpeed * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation));
        var newX = -1;
        var newY = -1;
        switch(args[0])
        {
            case "minus":
                newX = global.matches[player.matchId].playersObject[player.id].x - xCalculations;
                newY = global.matches[player.matchId].playersObject[player.id].y - yCalculations;
                break;
            case "plus":
                newX = global.matches[player.matchId].playersObject[player.id].x + xCalculations;
                newY = global.matches[player.matchId].playersObject[player.id].y + yCalculations;
                break;
        }
        if(validCoordinates(player, newX, newY))
        {
            global.matches[player.matchId].playersObject[player.id].x = newX;
            global.matches[player.matchId].playersObject[player.id].y = newY;
            io.to(String(player.matchId)).emit("matchExt", "playerMoved", [player.id, newX, newY, global.matches[player.matchId].playersObject[player.id].rotation]);
        }
    }
}

function integerInInterval(min, max) 
{  
    return Math.floor(Math.random() * (max - min) + min);
}

function validCoordinates(player, x, y)
{
    //checks also for overlapping other objects etc
    //for now it's only checking for world boundaries

    var playerRadius = config.characters[String(player.playerData.character)].matchWidth;
    if(config.characters[String(player.playerData.character)] > playerRadius)
        playerRadius = config.characters[String(player.playerData.character)].matchHeight;
    
    for(var playerId in global.matches[player.matchId].playersObject)
    {
        var enemyRadius = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchWidth;
        if(config.characters[String(global.matches[player.matchId].playersObject[playerId].character)] > enemyRadius)
            enemyRadius = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchHeight;

        if(playerId != player.id)
        {
            var isIntersecting = (Math.pow(x - global.matches[player.matchId].playersObject[playerId].x, 2) + Math.pow(y - global.matches[player.matchId].playersObject[playerId].y, 2)) <= Math.pow(playerRadius / 2 + enemyRadius / 2, 2);
            if(isIntersecting)
                return false;
        }
    }

    if(x < 0 || x > config.gameConfig.gameWidth || y < 0 || y > config.gameConfig.gameHeight)
        return false;
    return true;
}

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
