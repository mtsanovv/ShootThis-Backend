var logger = require('../util/logger.js');
var db = require('../util/handling/dbHandling.js');

class Player
{
    constructor(socket)
    {
        this.id;
        this.username;
        this.nickname;
        this.savedLoginCookie;
        this.loginToken;
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