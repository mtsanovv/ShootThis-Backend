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

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
