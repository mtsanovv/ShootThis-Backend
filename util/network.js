var logger = require('./logger.js');
var db = require('./handling/dbHandling.js');
var Player = require('../game/player.js');
var login = require('../game/login.js');

function init(io)
{
    io.on('connection', socket => {
        userConnected(socket);
        socket.on('disconnect', () => { userDisconnected(socket); });
    });
}

function userConnected(socket)
{
    for(var player in global.players)
        if(global.players[player].IP == socket.handshake.address)
            global.players[player].socket.disconnect();
    
    if(global.players.length + 1 <= global.serverDetails.maxUsers)
    {
        var player = new Player(socket);
        player.init();

        global.players.push(player);

        logger.log("User connected, currently connected users: " + global.players.length);
        if(global.serverDetails.type == "login")
            login.handleConnection(player);
            
        else if(global.serverDetails.type == "game")
        {
            //handle game
        }
    }
    else
    {
        logger.log("Server " + global.serverId + " has maxed out its capacity and just refused a connection", "w");
        socket.disconnect();
    }
}

function userDisconnected(socket)
{
    for(var player in global.players)
        if(global.players[player].socket == socket)
            global.players.splice(player, 1);
    logger.log("User disconnected, currently connected users: " + global.players.length);
}
module.exports.init = init;