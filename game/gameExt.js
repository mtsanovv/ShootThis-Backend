var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');

/* 
gameExt HANDLERS:
    p => ping
    joinServer => handleJoinServer
*/

//match packets are in the match ext

/*
gameExt SERVER RESPONSES:
    p => pong
    joinOk => user has joined successfully the server
    joinFail => user cannot be authenticated, disconnect after that
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
                        {
                            player.socket.emit("gameExt", "joinOk");
                            player.database.joinedWorldByUsername(args[0], player.IP, (err) => {});
                            player.database.updateColumnByUsername(args[0], "ip", player.IP, (err) => {});
                            player.loadPlayer();
                        }
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

function handleDisconnection(socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket == socket)
        {
            //disconnect from matches if inside a match etc
            global.players.splice(player, 1);
        }
    }
    logger.log("User disconnected " + global.players.length);
}


module.exports.handleConnection = handleConnection;
module.exports.handleWorldPacket = handleWorldPacket;
module.exports.handleDisconnection = handleDisconnection;