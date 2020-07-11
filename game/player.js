var logger = require('../util/logger.js');
var db = require('../util/handling/dbHandling.js');

class Player
{
    constructor(socket)
    {
        this.id;
        this.username;
        this.nickname;
        this.socket = socket;
        this.IP = socket.request.connection.remoteAddress;
        this.database;
        this.playerData;
    }

    init()
    {
        this.database = db.getDb();
    }

    loadPlayer(username)
    {
        this.database.getColumnsByUsername(username, ['id', 'username', 'nickname', 'playerData'], (err, result) => {
            this.id = result['id'];
            this.username = result['username'];
            this.nickname = result['nickname'];
            this.playerData = JSON.parse(result['playerData']); 
        });
       
    }
}

module.exports = Player;