var logger = require('./logger.js');
var db = require('./handling/dbHandling.js');
var Player = require('../game/player.js');
var login = require('../game/login.js');
var world = require('../game/world.js');

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
            socket.on('gameExt', (requestType, args) => { world.handleWorldPacket(player, requestType, args); });
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
    if(global.serverDetails.type == "login")
        login.handleDisconnection(socket);
    else if(global.serverDetails.type == "game")
        world.handleDisconnection(socket);
}
module.exports.init = init;