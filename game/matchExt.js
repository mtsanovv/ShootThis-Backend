var logger = require('../util/logger.js');
var config = require('../config.json');

/* 
matchExt HANDLERS:
    matchOk => handleJoinMatchOk
*/

/*
matchExt RESPONSES:
    matchStarted => respond with an object, consisting of all players
    leaveMatch => the user is forced to leave to lobby
    matchFail => everybody has left the match
    playerLeft => respond with the player id that left
    startMatch => match starts with the parameters given
    focusedPlayer => id of focused player
*/

//!! IMPORTANT !! only the connected array from the match object is to be used in matchExt as not all players could have joined

function handleMatchPacket(io, player, requestType, args)
{
    switch(requestType)
    {
        case "matchOk":
            handleJoinMatchOk(player);
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
            //when generating coordinates, check if they overlap with anything else before
            var x = integerInInterval(0, config.gameConfig.gameWidth);
            var y = integerInInterval(0, config.gameConfig.gameHeight);
            global.matches[matchId].playersObject[player.id] = {character: player.playerData.character, x: x, y: y, rotation: 0, width: config.characters[player.playerData.character].matchWidth, height: config.characters[player.playerData.character].matchHeight};
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
        //REMEMBER THE PLAYER HAS ALREADY BEEN REMOVED
    }
}

function integerInInterval(min, max) 
{  
    return Math.floor(Math.random() * (max - min) + min);
}

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
