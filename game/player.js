var logger = require('../util/logger.js');
var errorHandler = require('../util/unhandledError.js');
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
        this.matchDataDefault = { lastActions: {lastMoved: 0, lastShot: 0, lastReloaded: 0, lastHealed: 0}, joinedMatch: 0, savedFinalData: false, health: config.gameConfig.maxHealth, damageDone: 0, kills: 0, weapon: {id: 0, ammo: 0, hopup: 0, mag: 0, loadedAmmo: config.weapons[0].mags[0].ammoInMag} }
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

    saveFinalMatchData(hasDied = true)
    {
        if(this.joinedOk)
        {
            if(!this.matchData.savedFinalData && this.matchData.joinedMatch && this.matchId && Object.keys(global.matches).indexOf(String(this.matchId)) !== -1)
            {
                this.playerData.kills += this.matchData.kills;
                this.playerData.totalGames++;
                if(hasDied)
                    this.playerData.deaths++;

                this.playerData.lastMatchKills = this.matchData.kills;
                this.playerData.lastMatchDamageDone = this.matchData.damageDone;
                this.playerData.lastMatchTimeElapsed = new Date().valueOf() - this.matchData.joinedMatch;
                this.playerData.lastMatchPlacement = Object.keys(global.matches[this.matchId].playersObject).length + "/" + global.matches[this.matchId].connectedToMatch;
                this.playerData.lastMatchXp = this.playerData.lastMatchKills * config.gameConfig.killsToXpMultiplier + this.playerData.lastMatchDamageDone + Math.floor(this.playerData.lastMatchTimeElapsed / 1000) + (global.matches[this.matchId].connectedToMatch - Object.keys(global.matches[this.matchId].playersObject).length) * config.gameConfig.placementToXpMultiplier;

                this.playerData.xp += this.playerData.lastMatchXp;

                while(this.playerData.xp >= config.gameConfig.xpToLevel)
                {
                    this.playerData.xp -= config.gameConfig.xpToLevel;
                    this.playerData.level++;
                }

                var stringified = JSON.stringify(this.playerData);
                this.matchData.savedFinalData = true;

                this.database.updateColumnById(this.id, 'playerData', stringified, (error) => {
                    if(error)
                        errorHandler.logFatal(new Error("Failed to save final match data for player " + this.id + " when attempting to push data into the database."));
                });
            }
        }
    }
}

module.exports = Player;