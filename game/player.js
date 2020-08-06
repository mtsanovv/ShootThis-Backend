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
            this.socket.emit("gameExt", "joinOk");
            this.joinedOk = true;
            this.database.joinedWorldByUsername(username, this.IP, (err) => {});
            this.database.updateColumnByUsername(username, "ip", this.IP, (err) => {});
        });
       
    }

    async updateInData(key, value, callback)
    {
        if(this.joinedOk)
        {
            var oldValue = this.playerData[key];
            this.playerData[key] = value;
            var stringified = await JSON.stringify(this.playerData);
            this.database.updateColumnById(this.id, 'playerData', stringified, (error) => {
                if(error)
                    this.playerData[key] = oldValue;
                return callback(error);
            });
        }
    }
}

module.exports = Player;