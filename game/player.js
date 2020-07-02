var logger = require('../util/logger.js');
var db = require('../util/handling/dbHandling.js');

class Player
{
    constructor(socket)
    {
        this.socket = socket;
        this.IP = socket.handshake.address;
        this.database;
    }

    init()
    {
        this.database = db.getDb();
    }
}

module.exports = Player;