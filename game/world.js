var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');

/* 
WORLD HANDLERS:
    p => ping
*/

/*
WORLD SERVER RESPONSES:
    p => pong
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
            player.socket.emit("gameExt", "p");
            break;
        default:
            logger.log("Invalid handler (request type): " + requestType, 'w');
            break;
    }
}


module.exports.handleConnection = handleConnection;
module.exports.handleWorldPacket = handleWorldPacket;