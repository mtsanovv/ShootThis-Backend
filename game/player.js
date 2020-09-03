var logger = require('../util/logger.js');
var db = require('../util/databaseInterface.js');
var config = require('../config.json');
var lodash = require('lodash');

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
        this.matchDataDefault = { lastActions: {lastMoved: 0, lastShot: 0, lastReloaded: 0, lastHealed: 0}, health: config.gameConfig.maxHealth, kills: 0, weapon: {id: 0, ammo: 0, hopup: 0, mag: 0, loadedAmmo: config.weapons[0].mags[0].ammoInMag} }
        this.matchData = {};
        this.resetMatchData();
    }

    init()
    {
        this.database = db.getDb();
    }

    resetMatchData()
    {
        this.matchId = 0;
        this.matchData = lodash.cloneDeep(this.matchDataDefault);
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