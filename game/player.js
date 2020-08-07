var logger = require('../util/logger.js');
var db = require('../util/databaseInterface.js');
var config = require('../config.json');

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
        this.joinedOk = false;
        this.matchId = 0;
    }

    init()
    {
        this.database = db.getDb();
    }

    joinServerOk(username)
    {
        this.database.getColumnsByUsername(username, ['id', 'username', 'nickname', 'playerData'], async (err, result) => {
            this.id = result['id'];
            this.username = result['username'];
            this.nickname = result['nickname'];
            this.playerData = await JSON.parse(result['playerData']); 
            this.playerData.xpToLevel = config.gameConfig.xpToLevel;
            //xp to level is meant to be constant even if there's a different value in the database
            this.socket.emit("gameExt", "joinOk");
            this.joinedOk = true;
            this.database.joinedWorldByUsername(username, this.IP);
            this.database.updateColumnByUsername(username, "ip", this.IP);
        });
       
    }

    updateInData(key, value, callback = (error) => {})
    {
        if(this.joinedOk)
        {
            var oldValue = this.playerData[key];
            this.playerData[key] = value;
            var stringified = JSON.stringify(this.playerData);
            this.database.updateColumnById(this.id, 'playerData', stringified, (error) => {
                if(error)
                    this.playerData[key] = oldValue;
                return callback(error);
            });
        }
    }
}

module.exports = Player;