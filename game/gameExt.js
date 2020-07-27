var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');
var config = require('../config.json');

/* 
gameExt HANDLERS:
    p => ping
    joinServer => handleJoinServer
    userInfo => handleUserInfoRequest
    getCharacters => handleGetCharacters
    changeCharacter => handleChangeCharacter
    joinMatch => handleJoinMatch
    cancelJoin => handleCancelJoinMatch
*/

//match packets are in the match ext

/*
gameExt SERVER RESPONSES:
    p => pong
    joinOk => user has joined successfully the server
    joinFail => user cannot be authenticated, disconnect after that
    userInfo => respond with playerData if user has authenticated
    charactersData => respond with the characters object from config
    changeCharacter => respond with the changed character if successful
    joinMatch => respond with data about the match (how many players in match, min players, max players, is the player the host)
*/

function handleConnection(player)
{
    player.socket.emit("gameExt", "connectionSuccessful", [global.serverDetails.displayName]);
}

function handleWorldPacket(player, requestType, args)
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
            handleCancelJoinMatch(io, player);
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
        if(global.matches[match].players.length + 1 <= global.serverDetails.maxPlayersPerMatch)
        {
            global.matches[match].players.push(player.socket);
            player.socket.join(match);
            if(global.matches[match].players.length == global.serverDetails.maxPlayersPerMatch)
            {
                //broadcast to all players to start match
                return;
            }
            else
            {
                player.socket.emit("gameExt", "joinMatch", [global.matches[match].players.length, global.serverDetails.minPlayersPerMatch, global.serverDetails.maxPlayersPerMatch, false]);
                //broadcast to all other players in match queue the new player count
                return;
            }
        }
    }

    var matchId = new Date().valueOf();
    while(global.matches.hasOwnProperty(matchId))
        matchId++;
    var match = {players: [], started: false, id: matchId, host: player.socket};
    global.matches[matchId] = match;
    player.socket.emit("gameExt", "joinMatch", [global.matches[matchId].players.length, global.serverDetails.minPlayersPerMatch, global.serverDetails.maxPlayersPerMatch, true]);
    //the last element in the array of arguments is whether the player is host, in this case, they are

}

function handleCancelJoinMatch(io, player)
{

}

function leaveMatch(player)
{

}

function handleDisconnection(io, socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket == socket)
        {
            //disconnect from matches if inside a match etc
            global.players.splice(player, 1);
        }
    }
    logger.log("User disconnected");
}


module.exports.handleConnection = handleConnection;
module.exports.handleWorldPacket = handleWorldPacket;
module.exports.handleDisconnection = handleDisconnection;