var logger = require('../util/logger.js');
var db = require('../util/databaseInterface.js');

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
        this.playerData = {};
    }

    init()
    {
        this.database = db.getDb();
    }

    joinServerOk(username)
    {
        this.database.getColumnsByUsername(username, ['id', 'username', 'nickname', 'playerData'], (err, result) => {
            this.id = result['id'];
            this.username = result['username'];
            this.nickname = result['nickname'];
            this.playerData = JSON.parse(result['playerData']); 
            this.socket.emit("gameExt", "joinOk");
            this.database.joinedWorldByUsername(username, this.IP, (err) => {});
            this.database.updateColumnByUsername(username, "ip", this.IP, (err) => {});
        });
       
    }
}

module.exports = Player;