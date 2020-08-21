var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');
var config = require('../config.json');
var match = require('./matchExt.js');

/* 
gameExt (lobby) HANDLERS:
    p => ping
    joinServer => handleJoinServer
    userInfo => handleUserInfoRequest
    getCharacters => handleGetCharacters
    changeCharacter => handleChangeCharacter
    joinMatch => handleJoinMatch
    cancelJoin => leaveMatch
    requestMinPlayersForMatch => handleRequestMinPlayersForMatch
    voteChangeHost => handleVoteChangeHost
    startMatch => handleStartMatch
*/

/*
gameExt (lobby) SERVER RESPONSES:
    p => pong
    joinOk => user has joined successfully the server
    joinFail => user cannot be authenticated, disconnect after that
    userInfo => respond with playerData if user has authenticated
    charactersData => respond with the characters object from config
    changeCharacter => respond with the changed character if successful
    joinMatch => respond with data about the match (how many players in match, min players, max players, is the player the host)
    updateMatch => respond with data about the match (how many players in match, max players)
    minPlayersForMatch => respond with the minimum amount of players, required to start a match, voting quorum numerator and denominator
    changeHost => respond with current count of players and whether the recipient is host or not
    startMatch => respond with the time that the user will wait before the match is started

 */

function handleConnection(player)
{
    player.socket.emit("gameExt", "connectionSuccessful", [global.serverDetails.displayName]);
}

function handleWorldPacket(io, player, requestType, args)
{
    switch(requestType)
    {
        case "p":
            player.socket.emit("gameExt", "p", [global.serverDetails.displayName]);
            break;
        case "joinServer":
            handleJoinServer(player, args);
            break;
        case "userInfo":
            handleUserInfoRequest(player);
            break;
        case "getCharacters":
            handleGetCharacters(player);
            break;
        case "changeCharacter":
            handleChangeCharacter(player, args);
            break;
        case "joinMatch":
            handleJoinMatch(io, player);
            break;
        case "cancelJoin":
            leaveMatch(io, player);
            break;
        case "requestMinPlayersForMatch":
            handleRequestMinPlayersForMatch(player);
            break;
        case "voteChangeHost":
            handleVoteChangeHost(player);
            break;
        case "startMatch":
            handleStartMatch(io, 0, player);
            break;
        default:
            logger.log("Invalid gameExt handler: " + requestType, 'w');
            break;
    }
}

function handleJoinServer(player, args)
{
    player.database.getColumnsByUsername(args[0], ['loginToken', 'loginTokenExpiry'], (err, result) => {
        if(new Date(result["loginTokenExpiry"]).valueOf() > new Date().valueOf())
        {
            bcrypt.compare(result["loginToken"], args[1], function(err, res) {
                player.database.updateColumnByUsername(args[0], 'loginToken', '', (err) => {
                    if(err)
                    {
                        player.socket.emit("gameExt", "joinFail");
                        player.socket.disconnect();
                    }
                    else
                    {
                        if(res === true)
                            player.joinServerOk(args[0]);
                        else
                        {
                            player.socket.emit("gameExt", "joinFail");
                            player.socket.disconnect();
                        }
                    }
                });
            });
        }
        else
        {
            player.socket.emit("gameExt", "joinFail");
            player.socket.disconnect();
        }
    });
}

function handleUserInfoRequest(player)
{
    player.socket.emit("gameExt", "userInfo", [player.nickname, player.playerData]);
}

function handleGetCharacters(player)
{
    player.socket.emit("gameExt", "charactersData", [config.characters]);
}

function handleChangeCharacter(player, args)
{
    if(args[0] in config.characters && String(player.playerData.character) != args[0])
        player.updateInData("character", config.characters[args[0]].id, (error) => {
            if(!error)
                player.socket.emit("gameExt", "changeCharacter", [args[0]]);
        });
}

function handleJoinMatch(io, player)
{
    for(var match in global.matches)
    {
        if(global.matches[match].players.length + 1 <= config.gameConfig.maxPlayersPerMatch && !global.matches[match].started)
        {
            global.matches[match].players.push(player.socket);
            player.socket.join(String(match));
            player.matchId = match;
            if(global.matches[match].players.length == config.gameConfig.maxPlayersPerMatch)
                handleStartMatch(io, match);
            else
            {
                player.socket.emit("gameExt", "joinMatch", [global.matches[match].players.length, config.gameConfig.minPlayersPerMatch, config.gameConfig.maxPlayersPerMatch, false]);
                player.socket.to(String(match)).emit("gameExt", "updateMatch", [global.matches[match].players.length, config.gameConfig.minPlayersPerMatch, config.gameConfig.maxPlayersPerMatch]);
            }
            return;
        }
    }

    var matchId = new Date().valueOf();
    while(global.matches.hasOwnProperty(matchId))
        matchId++;
    var match = {players: [player.socket], playersObject: {}, obstaclesArray: [], spawnablesArray: [], connected: [], failed: false, connectionsCheckPassed: false, started: false, id: matchId, host: player.socket, voters: [], connectedToMatch: []};
    global.matches[matchId] = match;
    player.socket.join(String(matchId));
    player.matchId = matchId;
    player.socket.emit("gameExt", "joinMatch", [global.matches[matchId].players.length, config.gameConfig.minPlayersPerMatch, config.gameConfig.maxPlayersPerMatch, true]);
    //the last element in the array of arguments is whether the player is host, in this case, they are

}

function leaveMatch(io, player)
{
    var matchId = player.matchId;
    if(matchId)
    {
        player.socket.leave(String(matchId), () => {
            for(var socket in global.matches[matchId].players)
            {
                if(global.matches[matchId].players[socket] === player.socket)
                {
                    if(global.matches[matchId].started)
                    {
                        var isUserConnected = global.matches[matchId].connected.indexOf(player.socket);
                        if(isUserConnected !== -1)
                            global.matches[matchId].connected.splice(isUserConnected, 1);
                        global.matches[matchId].players.splice(socket, 1);
                        match.playerLeft(io, player);
                        if(player.joinedOk) 
                            player.socket.emit("gameExt", "joinOk");
                    }
                    else
                    {
                        if(global.matches[matchId].failed && player.joinedOk)
                            player.socket.emit("gameExt", "joinOk");
                        global.matches[matchId].players.splice(socket, 1);
                        if(!global.matches[matchId].players.length)
                            delete global.matches[matchId];
                        else
                        {
                            var hasPlayerVotedAgainstHost = global.matches[matchId].voters.indexOf(player.socket.id);
                            if(hasPlayerVotedAgainstHost != -1)
                                global.matches[matchId].voters.splice(hasPlayerVotedAgainstHost, 1);
                            player.socket.to(String(matchId)).emit("gameExt", "updateMatch", [global.matches[matchId].players.length, config.gameConfig.minPlayersPerMatch, config.gameConfig.maxPlayersPerMatch]);
                            if(global.matches[matchId].host === player.socket || global.matches[matchId].voters.length >= Math.floor(config.gameConfig.votingQuorumNumerator / config.gameConfig.votingQuorumDenominator * global.matches[matchId].players.length))
                            {
                                global.matches[matchId].voters.length = 0;
                                global.matches[matchId].host = global.matches[matchId].players[0];
                                global.matches[matchId].host.to(String(matchId)).emit("gameExt", "changeHost", [global.matches[matchId].players.length, false]);
                                //others are not hosts
                                global.matches[matchId].host.emit("gameExt", "changeHost", [global.matches[matchId].players.length, true]);
                                //the player is host
                            }
                        }
                    }
                    player.matchId = 0;
                    break;
                }
            }
        });
    }
}

function handleVoteChangeHost(player)
{
    if(global.matches[player.matchId].players.indexOf(player.socket) !== -1)
    {
        var hasPlayerVotedAgainstHost = global.matches[player.matchId].voters.indexOf(player.socket.id);
        if(hasPlayerVotedAgainstHost === -1)
        {
            global.matches[player.matchId].voters.push(player.socket.id);
            if(global.matches[player.matchId].voters.length >= Math.floor(config.gameConfig.votingQuorumNumerator / config.gameConfig.votingQuorumDenominator * global.matches[player.matchId].players.length))
            {
                var newHostIndex = global.matches[player.matchId].players.indexOf(global.matches[player.matchId].host) + 1;
                if(newHostIndex >= global.matches[player.matchId].players.length)
                    newHostIndex = 0;
                global.matches[player.matchId].voters.length = 0;
                global.matches[player.matchId].host = global.matches[player.matchId].players[newHostIndex];
                global.matches[player.matchId].host.to(String(player.matchId)).emit("gameExt", "changeHost", [global.matches[player.matchId].players.length, false]);
                //others are not hosts
                global.matches[player.matchId].host.emit("gameExt", "changeHost", [global.matches[player.matchId].players.length, true]);
                //the player is host
            }
        }
    }
}

function handleStartMatch(io, matchId, player = null)
{
    if(player !== null)
    {
        if(player.matchId && global.matches[player.matchId].host == player.socket && global.matches[player.matchId].players.length >= config.gameConfig.minPlayersPerMatch)
        {
            io.to(String(player.matchId)).emit("gameExt", "startMatch", [config.gameConfig.timeToWaitBeforeMatch]);
            match.startMatch(io, player.matchId);
        }
        return;
    }
    io.to(String(matchId)).emit("gameExt", "startMatch", [config.gameConfig.timeToWaitBeforeMatch]);
    match.startMatch(io, matchId);
}

function handleRequestMinPlayersForMatch(player)
{
    player.socket.emit("gameExt", "minPlayersForMatch", [config.gameConfig.minPlayersPerMatch, config.gameConfig.votingQuorumNumerator, config.gameConfig.votingQuorumDenominator]);
}

function handleDisconnection(io, socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket === socket)
        {
            leaveMatch(io, global.players[player]);
            global.players.splice(player, 1);
            break;
        }
    }
    logger.log("User disconnected");
}


module.exports.handleConnection = handleConnection;
module.exports.handleWorldPacket = handleWorldPacket;
module.exports.handleDisconnection = handleDisconnection;