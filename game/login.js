var logger = require('../util/logger.js');

function handleConnection(player)
{
    player.socket.emit("loginExt", "connectionSuccessful");
}

module.exports.handleConnection = handleConnection;