var logger = require('./logger.js');
var db = require('./databaseInterface.js');
var Player = require('../game/player.js');
var login = require('../game/loginExt.js');
var world = require('../game/gameExt.js');
var match = require('../game/matchExt.js');

function init(io)
{
    io.on('connection', socket => {
        userConnected(io, socket);
        socket.on('disconnect', () => { userDisconnected(io, socket); });
    });
}

function userConnected(io, socket)
{
    for(var player = 0; player < global.players.length; player++)
        if(global.players[player].IP == socket.request.connection.remoteAddress)
            global.players[player].socket.disconnect();
    
    if(global.players.length + 1 <= global.serverDetails.maxUsers)
    {
        var player = new Player(socket);
        player.init();

        global.players.push(player);

        logger.log("User connected");

        if(global.serverDetails.type == "login")
        {
            login.handleConnection(player);
            socket.on('loginExt', (requestType, args) => { login.handleLoginRequest(player, requestType, args); });
        }
            
        else if(global.serverDetails.type == "game")
        {
            world.handleConnection(player);
            socket.on('gameExt', (requestType, args) => { world.handleWorldPacket(io, player, requestType, args); });
            socket.on('matchExt', (requestType, args) => { match.handleMatchPacket(io, player, requestType, args); });
        }
    }
    else
    {
        logger.log("Server " + global.serverId + " has maxed out its capacity and just refused a connection", "w");
        socket.disconnect();
    }
}

function userDisconnected(io, socket)
{
    if(global.serverDetails.type == "login")
        login.handleDisconnection(socket);
    else if(global.serverDetails.type == "game")
        world.handleDisconnection(io, socket);
}
module.exports.init = init;