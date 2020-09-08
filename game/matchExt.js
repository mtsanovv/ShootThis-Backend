var logger = require('../util/logger.js');
var config = require('../config.json');
var intersects = require('intersects');
var lodash = require('lodash');

/* 
matchExt HANDLERS:
    matchOk => handleJoinMatchOk
    rotatePlayer => handleRotatePlayer
    movePlayer => handleMovePlayer,
    shoot => handlePlayerShoot
    gotShot => handlePlayerGotShot
    reload => handlePlayerReload,
    pickItem => handlePlayerPickItem
*/

/*
matchExt RESPONSES:
    leaveMatch => the user is forced to leave to lobby
    matchFail => everybody has left the match
    playerLeft => respond with the player id that left
    startMatch => match starts with the parameters given
    focusedPlayer => id of focused player
    playerRotated => respond with the rotation parameter for the given player
    playerMoved => respond with the new x, y and rotation for the given player
    weaponUpdate => data about player's weapon (loaded ammo, available ammo to load, weapon name, mags & hopups)
    playerShot => the angle and the origin x, y of the bullet and player id about the player who has shot
    playerKilled => the name of the player you have killed
    killed => the name of the player who has killed you and your placement,
    healthUpdate => the health a player has, max health bar width and max health to determine the scaling factor
    ammoUpdate => data about player's weapon - loaded & available ammo,
    spawnablesUpdate => data about removed spawnables and added spawnables,
    damageDealt => player id and damage dealt to them
    showHint => hint to show
*/

//!! IMPORTANT !! only the connected array from the match object is to be used in matchExt as not all players could have joined

function handleMatchPacket(io, player, requestType, args)
{
    switch(requestType)
    {
        case "matchOk":
            handleJoinMatchOk(player);
            break;
        case "rotatePlayer":
            handleRotatePlayer(player, args);
            break;
        case "movePlayer":
            handleMovePlayer(io, player, args);
            break;
        case "shoot":
            handlePlayerShoot(io, player);
            break;
        case "gotShot":
            handlePlayerGotShot(player, args);
            break;
        case "reload":
            handlePlayerReload(player);
            break;
        case "pickItem":
            handlePlayerPickItem(io, player);
            break;
        default:
            logger.log("Invalid matchExt handler: " + requestType, 'w');
            break;
    }
}

async function startMatch(io, matchId)
{
    global.matches[matchId].started = true;
    await new Promise(resolve => setTimeout(resolve, config.gameConfig.timeToWaitBeforeMatch));
    for(var player in global.matches[matchId].players)
    {
        var socket = global.matches[matchId].players[player];
        if(global.matches[matchId].connected.indexOf(socket) === -1)
            socket.emit("matchExt", "leaveMatch");
    }

    global.matches[matchId].connectionsCheckPassed = true;

    if(global.matches[matchId].connected.length < config.gameConfig.minPlayersPerMatch)
    {
        for(var socket in global.matches[matchId].connected)
            global.matches[matchId].connected[socket].emit("matchExt", "matchFail");
        global.matches[matchId].started = false;
        global.matches[matchId].failed = true;
        if(!global.matches[matchId].connected.length && !global.matches[matchId].players.length)
            delete global.matches[matchId];
        return;
    }

    //spawn obstacles
    var obstaclesToSpawn = integerInInterval(config.gameConfig.minObstacles, config.gameConfig.maxObstacles);
    var rectanglesToCheckAgainst = [];

    for(var i = 0; i < obstaclesToSpawn; i++)
    {
        var obstacleType = integerInInterval(0, Object.keys(config.obstacles).length); //generates a number in the interval [min, max) so it's fine to use the length
        var width = config.obstacles[String(obstacleType)].matchWidth;
        var height = config.obstacles[String(obstacleType)].matchHeight;
        var x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
        var y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);

        for(var j = 0; j < rectanglesToCheckAgainst.length; j++)
        {
            var isIntersecting = intersects.boxBox(x, y, width, height, rectanglesToCheckAgainst[j][0], rectanglesToCheckAgainst[j][1], rectanglesToCheckAgainst[j][2], rectanglesToCheckAgainst[j][3]);
            if(isIntersecting)
            {
                x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
                y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);
                j = -1;
            }
        }
        rectanglesToCheckAgainst.push([x, y, width, height]);
        global.matches[matchId].obstaclesArray.push({type: obstacleType, x: x, y: y});
    }

    //spawn spawnables
    for(var spawnable in config.spawnables)
    {
        if(!config.spawnables[spawnable].active)
            continue;

        var spawnablesToSpawn = integerInInterval(config.spawnables[spawnable].minSpawnCount, config.spawnables[spawnable].maxSpawnCount);
        for(var i = 0; i < spawnablesToSpawn; i++)
        {
            var width = config.spawnables[spawnable].matchWidth;
            var height = config.spawnables[spawnable].matchHeight;
            var x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
            var y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);

            for(var j = 0; j < rectanglesToCheckAgainst.length; j++)
            {
                var isIntersecting = intersects.boxBox(x, y, width, height, rectanglesToCheckAgainst[j][0], rectanglesToCheckAgainst[j][1], rectanglesToCheckAgainst[j][2], rectanglesToCheckAgainst[j][3]);
                if(isIntersecting)
                {
                    x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
                    y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);
                    j = -1;
                }
            }
            rectanglesToCheckAgainst.push([x, y, width, height]);
            global.matches[matchId].spawnablesArray.push({id: spawnable, x: x, y: y, width: width, height: height, name: config.spawnables[spawnable].name, type: config.spawnables[spawnable].type, spriteKey: config.spawnables[spawnable].spriteKey});
        }
    }

    //spawn players
    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = getPlayerBySocket(playerSocket);
        if(player)
        {
            var width = config.characters[String(player.playerData.character)].matchWidth;
            var height = config.characters[String(player.playerData.character)].matchHeight;
            var x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
            var y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);
            
            for(var j = 0; j < rectanglesToCheckAgainst.length; j++)
            {
                //despite the fact that x and y are the center of a circle,  we can still calculate the initial x and y of the original player box before they are spawned to ensure that there are no collisions
                var isIntersecting = intersects.boxBox(x - width / 2, y - height / 2, width, height, rectanglesToCheckAgainst[j][0], rectanglesToCheckAgainst[j][1], rectanglesToCheckAgainst[j][2], rectanglesToCheckAgainst[j][3]);
                if(isIntersecting)
                {
                    x = integerInInterval(0 + width + config.wallTiles.vertical.width, config.gameConfig.gameWidth - width - config.wallTiles.vertical.width);
                    y = integerInInterval(0 + height + config.wallTiles.horizontal.height, config.gameConfig.gameHeight - height - config.wallTiles.horizontal.height);
                    j = -1;
                }
            }
            rectanglesToCheckAgainst.push([x - width / 2, y - height / 2, width, height]);
            global.matches[matchId].playersObject[player.id] = {character: player.playerData.character, nickname: player.nickname, x: x, y: y, rotation: 0, centerX: config.characters[String(player.playerData.character)].centerX, centerY: config.characters[String(player.playerData.character)].centerY, hitboxDiameter: config.characters[String(player.playerData.character)].hitboxDiameter};
            player.socket.emit("matchExt", "focusedPlayer", [player.id]);
        }
        else
            global.matches[matchId].connected[socket].emit("matchExt", "matchFail");
    }

    var biggestMagSize = 0;
    for(var weapon in config.weapons)
    {
        for(var mag in config.weapons[weapon].mags)
        {
            if(config.weapons[weapon].mags[mag].ammoInMag > biggestMagSize)
                biggestMagSize = config.weapons[weapon].mags[mag].ammoInMag;
        }
    }
    
    io.to(String(matchId)).emit("matchExt", "startMatch", [config.gameConfig.cameraBoundX, config.gameConfig.cameraBoundY, global.matches[matchId].playersObject, global.matches[matchId].obstaclesArray, global.matches[matchId].spawnablesArray, config.gameConfig.gameWidth, config.gameConfig.gameHeight, config.wallTiles.horizontal.height, biggestMagSize, config.hints]);
    
    //send players data about their weapon config
    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = getPlayerBySocket(playerSocket);
        if(player)
        {
            player.socket.emit("matchExt", "weaponUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo, player.matchData.weapon.hopup, player.matchData.weapon.mag, player.matchData.weapon.id, config.weapons[String(player.matchData.weapon.id)].name]);
            player.socket.emit("matchExt", "healthUpdate", [player.matchData.health, config.gameConfig.healthBarMaxWidth, config.gameConfig.maxHealth]);
        }
    }
}

function getPlayerBySocket(socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket === socket)
            return global.players[player];
    }
    return null;
}

function getPlayerById(id)
{
    for(var player in global.players)
    {
        if(global.players[player].id === id)
            return global.players[player];
    }
    return null;
}

function handleJoinMatchOk(player)
{
    if(global.matches[player.matchId].players.indexOf(player.socket) !== -1 && global.matches[player.matchId].connected.indexOf(player.socket) === -1)
    {
        global.matches[player.matchId].connected.push(player.socket);
        global.matches[player.matchId].connectedToMatch++;
    }
}

function playerLeft(io, player)
{
    //the player at this point has already left the match and its room, but the matchId is still active
    if(!global.matches[player.matchId].connected.length && !global.matches[player.matchId].players.length && global.matches[player.matchId].connectionsCheckPassed)
    { 
        delete global.matches[player.matchId];
        return;
    }

    if(global.matches[player.matchId].connected.length)
    {
        io.to(String(player.matchId)).emit("matchExt", "playerLeft", [player.id]);
        if(Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
            delete global.matches[player.matchId].playersObject[player.id];
    }
}

function handleRotatePlayer(player, args)
{
    if(Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        global.matches[player.matchId].playersObject[player.id].rotation = args[0];
        player.socket.to(String(player.matchId)).emit("matchExt", "playerRotated", [player.id, args[0]]);
    }
}

function handleMovePlayer(io, player, args)
{
    var now = new Date().valueOf();
    if((now - player.matchData.lastActions.lastMoved) > config.gameConfig.timeBetweenMovement && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.matchData.lastActions.lastMoved = now;
        var xCalculations = Math.round(config.gameConfig.playerSpeed * Math.cos(global.matches[player.matchId].playersObject[player.id].rotation));
        var yCalculations = Math.round(config.gameConfig.playerSpeed * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation));
        var newX = -1;
        var newY = -1;
        switch(args[0])
        {
            case "minus":
                newX = global.matches[player.matchId].playersObject[player.id].x - xCalculations;
                newY = global.matches[player.matchId].playersObject[player.id].y - yCalculations;
                break;
            case "plus":
                newX = global.matches[player.matchId].playersObject[player.id].x + xCalculations;
                newY = global.matches[player.matchId].playersObject[player.id].y + yCalculations;
                break;
        }
        if(validCoordinates(player, newX, newY))
        {
            global.matches[player.matchId].playersObject[player.id].x = newX;
            global.matches[player.matchId].playersObject[player.id].y = newY;
            io.to(String(player.matchId)).emit("matchExt", "playerMoved", [player.id, newX, newY, global.matches[player.matchId].playersObject[player.id].rotation]);
        }
    }
}

function integerInInterval(min, max) 
{
    //it generates a number in the interval [min, max)  
    return Math.floor(Math.random() * (max - min) + min);
}

function validCoordinates(player, x, y)
{
    var playerDiameter = config.characters[String(player.playerData.character)].hitboxDiameter;

    var playerSpriteDiameter = config.characters[String(player.playerData.character)].matchWidth;
    if(config.characters[String(player.playerData.character)] > playerSpriteDiameter)
        playerSpriteDiameter = config.characters[String(player.playerData.character)].matchHeight;
    
    //check against other players
    for(var playerId in global.matches[player.matchId].playersObject)
    {
        var enemySpriteDiameter = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchWidth;
        if(config.characters[String(global.matches[player.matchId].playersObject[playerId].character)] > enemySpriteDiameter)
            enemySpriteDiameter = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchHeight;

        if(playerId != player.id)
        {
            var isIntersecting = intersects.circleCircle(x, y, playerSpriteDiameter / 2, global.matches[player.matchId].playersObject[playerId].x, global.matches[player.matchId].playersObject[playerId].y, enemySpriteDiameter / 2);
            if(isIntersecting)
                return false;
        }
    }

    //check against obstacles
    for(var obstacleKey in global.matches[player.matchId].obstaclesArray)
    {
        var obstacle = global.matches[player.matchId].obstaclesArray[obstacleKey];
        var hitbox = scaleHitboxToReal(obstacle.x, obstacle.y, config.obstacles[String(obstacle.type)].matchWidth, config.obstacles[String(obstacle.type)].matchHeight, config.obstacles[String(obstacle.type)].hitbox);
        for(var polygon in hitbox)
        {
            var isIntersecting = intersects.circlePolygon(x, y, playerDiameter / 2, hitbox[polygon]);
            if(isIntersecting)
                return false;
        }
    }

    //check against world walls
    //          2
    // walls - 1 3
    //          4
    var walls = [];
    walls.push(intersects.circleBox(x, y, playerDiameter / 2, 0, 0, config.wallTiles.vertical.width, config.gameConfig.gameHeight)); //wall 1
    walls.push(intersects.circleBox(x, y, playerDiameter / 2, config.wallTiles.vertical.width, 0, config.gameConfig.gameWidth - config.wallTiles.vertical.width, config.wallTiles.horizontal.height)); //wall 2
    walls.push(intersects.circleBox(x, y, playerDiameter / 2, config.gameConfig.gameWidth - config.wallTiles.vertical.width, 0, config.wallTiles.vertical.width, config.gameConfig.gameHeight)); //wall 3
    walls.push(intersects.circleBox(x, y, playerDiameter / 2, config.wallTiles.vertical.width, config.gameConfig.gameHeight - config.wallTiles.horizontal.height, config.gameConfig.gameWidth - config.wallTiles.vertical.width, config.wallTiles.horizontal.height)); //wall 4
    if(walls.indexOf(true) !== -1)
        return false;
    return true;
}

function scaleHitboxToReal(x, y, width, height, hitbox)
{
    var newHitbox = [];
    for(var polygon in hitbox)
    {
        newHitbox[polygon] = [];
        for(var polygonCoordinates = 0; polygonCoordinates < hitbox[polygon].length; polygonCoordinates++)
        {
            if(polygonCoordinates % 2 === 0)
                newHitbox[polygon][polygonCoordinates] = hitbox[polygon][polygonCoordinates] * width + x;
            else
                newHitbox[polygon][polygonCoordinates] = hitbox[polygon][polygonCoordinates] * height + y;
        }
    }

    return newHitbox;
}

function handlePlayerShoot(io, player)
{
    var now = new Date().valueOf();
    var weaponParameters = config.weapons[String(player.matchData.weapon.id)].hopups[String(player.matchData.weapon.hopup)];
    if((now - player.matchData.lastActions.lastHealed) > config.gameConfig.timeToHeal && (now - player.matchData.lastActions.lastShot) > weaponParameters.timeBetweenFire && (now - player.matchData.lastActions.lastReloaded) > weaponParameters.timeToReload && player.matchData.weapon.loadedAmmo > 0 && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.matchData.lastActions.lastShot = now;
        player.matchData.weapon.loadedAmmo -= weaponParameters.bulletsPerShot;
        var bulletX = global.matches[player.matchId].playersObject[player.id].x + ((config.characters[String(player.playerData.character)].bulletOriginX - config.characters[String(player.playerData.character)].centerX) * config.characters[String(player.playerData.character)].matchWidth) * Math.cos(global.matches[player.matchId].playersObject[player.id].rotation);
        var bulletY = global.matches[player.matchId].playersObject[player.id].y + ((config.characters[String(player.playerData.character)].bulletOriginY - config.characters[String(player.playerData.character)].centerY) * config.characters[String(player.playerData.character)].matchHeight) * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation) + ((config.characters[String(player.playerData.character)].bulletOriginX - config.characters[String(player.playerData.character)].centerX) * config.characters[String(player.playerData.character)].matchWidth) * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation);
        io.to(String(player.matchId)).emit("matchExt", "playerShot", [player.id, now, weaponParameters.bulletTravelTime, weaponParameters.bulletTravelDistance, bulletX, bulletY, global.matches[player.matchId].playersObject[player.id].rotation, weaponParameters.damagePerShot, weaponParameters.bulletSoundMaxDistance]);
        player.socket.emit("matchExt", "ammoUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo]);
    }
}

function handlePlayerReload(player)
{
    var now = new Date().valueOf();
    var weaponParameters = config.weapons[String(player.matchData.weapon.id)].hopups[String(player.matchData.weapon.hopup)];
    var weaponAmmo = config.weapons[String(player.matchData.weapon.id)].mags[String(player.matchData.weapon.mag)];
    
    if((now - player.matchData.lastActions.lastHealed) > config.gameConfig.timeToHeal && (now - player.matchData.lastActions.lastShot) > weaponParameters.timeBetweenFire && (now - player.matchData.lastActions.lastReloaded) > weaponParameters.timeToReload && player.matchData.weapon.loadedAmmo < weaponAmmo.ammoInMag && player.matchData.weapon.ammo > 0 && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.matchData.lastActions.lastReloaded = now;
        if(player.matchData.weapon.ammo - weaponAmmo.ammoInMag < 0)
        {
            player.matchData.weapon.loadedAmmo += player.matchData.weapon.ammo;
            player.matchData.weapon.ammo = 0;
        }
        else
        {
            player.matchData.weapon.ammo -= weaponAmmo.ammoInMag - player.matchData.weapon.loadedAmmo;
            player.matchData.weapon.loadedAmmo = weaponAmmo.ammoInMag;
        }
        player.socket.emit("matchExt", "ammoUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo]);
    }
}

function handlePlayerGotShot(player, args)
{
    if(Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.matchData.health -= args[1];
        var killer = getPlayerById(args[0]);
        if(player.matchData.health < config.gameConfig.minHealth)
        {
            if(killer !== null)
            {
                //stuff to push to database for the killed player for their last match data
                killer.socket.emit("matchExt", "playerKilled", [player.nickname]);
                killer.matchData.kills++;
                player.socket.emit("matchExt", "killed", [killer.nickname, Object.keys(global.matches[player.matchId].playersObject).length + "/" + global.matches[player.matchId].connectedToMatch]);
                player.socket.to(String(player.matchId)).emit("matchExt", "playerLeft", [player.id]);
                delete global.matches[player.matchId].playersObject[player.id];
            }
        }
        else
        {
            player.socket.emit("matchExt", "healthUpdate", [player.matchData.health, config.gameConfig.healthBarMaxWidth, config.gameConfig.maxHealth]);
            if(killer !== null)
                killer.socket.emit("matchExt", "damageDealt", [player.id, args[1]]);
        }
    }
}

function handlePlayerPickItem(io, player)
{
    var now = new Date().valueOf();
    var weaponParameters = config.weapons[String(player.matchData.weapon.id)].hopups[String(player.matchData.weapon.hopup)];
    
    if((now - player.matchData.lastActions.lastHealed) > config.gameConfig.timeToHeal && (now - player.matchData.lastActions.lastReloaded) > weaponParameters.timeToReload && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        var spawnableKey = -1;
        var spawnablesToAdd = [];

        for(var spawnable in global.matches[player.matchId].spawnablesArray)
        {
            let spawnableData = global.matches[player.matchId].spawnablesArray[spawnable];
            if(intersects.boxCircle(spawnableData.x, spawnableData.y, spawnableData.width, spawnableData.height, global.matches[player.matchId].playersObject[player.id].x, global.matches[player.matchId].playersObject[player.id].y, global.matches[player.matchId].playersObject[player.id].hitboxDiameter))
            {
                spawnableKey = spawnable;
                break;
            }
        }

        if(spawnableKey !== -1)
        {
            var spawnableData = global.matches[player.matchId].spawnablesArray[spawnableKey];
            var idInfo = spawnableData.id.split("-");
            switch(idInfo[2])
            {
                //hopups for all weapons
                case "hopups":
                    if(player.matchData.weapon.id == idInfo[1])
                    {
                        if(player.matchData.weapon.hopup != idInfo[3])
                        {
                            if(player.matchData.weapon.hopup !== 0)
                            {
                                let hopupIdToSpawn = "weapons-" + player.matchData.weapon.id + "-hopups-" + player.matchData.weapon.hopup;
                                spawnablesToAdd.push({id: hopupIdToSpawn, x: spawnableData.x, y: spawnableData.y, width: config.spawnables[hopupIdToSpawn].matchWidth, height: config.spawnables[hopupIdToSpawn].matchHeight, name: config.spawnables[hopupIdToSpawn].name, type: config.spawnables[hopupIdToSpawn].type, spriteKey: config.spawnables[hopupIdToSpawn].spriteKey});
                            }
                            player.matchData.weapon.hopup = Number(idInfo[3]);
                            player.socket.emit("matchExt", "weaponUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo, player.matchData.weapon.hopup, player.matchData.weapon.mag, player.matchData.weapon.id, config.weapons[String(player.matchData.weapon.id)].name]);
                            updateSpawnablesInWorld(io, player.matchId, spawnableKey, spawnablesToAdd);
                        }
                        else
                            player.socket.emit("matchExt", "showHint", [config.hints.errorAttachingHopup]);
                    }
                    break;

                //ammo for all weapons
                case "ammo":
                    if(player.matchData.weapon.id == idInfo[1])
                    {
                        if(player.matchData.weapon.ammo < weaponParameters.maxAmmo)
                        {
                            player.matchData.weapon.ammo += config.spawnables[spawnableData.id].ammoGiven;
                            if(player.matchData.weapon.ammo > weaponParameters.maxAmmo)
                                player.matchData.weapon.ammo = weaponParameters.maxAmmo;

                            player.socket.emit("matchExt", "weaponUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo, player.matchData.weapon.hopup, player.matchData.weapon.mag, player.matchData.weapon.id, config.weapons[String(player.matchData.weapon.id)].name]);
                            updateSpawnablesInWorld(io, player.matchId, spawnableKey, spawnablesToAdd);
                        }
                        else
                            player.socket.emit("matchExt", "showHint", [config.hints.errorPickingAmmo]);
                    }
                    break;
                
                //mag extensions for all weapons
                case "mags":
                    if(player.matchData.weapon.id == idInfo[1])
                    {
                        if(player.matchData.weapon.mag != idInfo[3])
                        {
                            if(player.matchData.weapon.mag < Number(idInfo[3]))
                            {
                                if(player.matchData.weapon.mag !== 0)
                                {
                                    let magIdToSpawn = "weapons-" + player.matchData.weapon.id + "-mags-" + player.matchData.weapon.mag;
                                    spawnablesToAdd.push({id: magIdToSpawn, x: spawnableData.x, y: spawnableData.y, width: config.spawnables[magIdToSpawn].matchWidth, height: config.spawnables[magIdToSpawn].matchHeight, name: config.spawnables[magIdToSpawn].name, type: config.spawnables[magIdToSpawn].type, spriteKey: config.spawnables[magIdToSpawn].spriteKey});
                                }
                                player.matchData.weapon.mag = Number(idInfo[3]);
                                player.socket.emit("matchExt", "weaponUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo, player.matchData.weapon.hopup, player.matchData.weapon.mag, player.matchData.weapon.id, config.weapons[String(player.matchData.weapon.id)].name]);
                                updateSpawnablesInWorld(io, player.matchId, spawnableKey, spawnablesToAdd);
                            }
                            else
                                player.socket.emit("matchExt", "showHint", [config.hints.errorAttachingMag2]);
                        }
                        else
                            player.socket.emit("matchExt", "showHint", [config.hints.errorAttachingMag1]);
                    }
                    break;

                case "health":
                    if(player.matchData.health < config.gameConfig.maxHealth)
                    {
                        player.matchData.health += config.spawnables[spawnableData.id].healthGiven;
                        if(player.matchData.health > config.gameConfig.maxHealth)
                            player.matchData.health = config.gameConfig.maxHealth;
                        player.matchData.lastActions.lastHealed = new Date().valueOf();
                        player.socket.emit("matchExt", "healthUpdate", [player.matchData.health, config.gameConfig.healthBarMaxWidth, config.gameConfig.maxHealth]);
                        updateSpawnablesInWorld(io, player.matchId, spawnableKey, spawnablesToAdd);
                        player.socket.emit("matchExt", "showHint", [config.hints.healingHint + String(Math.round(config.gameConfig.timeToHeal / 100) / 10) + "s", config.gameConfig.timeToHeal]);
                    }
                    else
                        player.socket.emit("matchExt", "showHint", [config.hints.errorPickingHealth]);
                    break;
            }
        }
    }

}

function updateSpawnablesInWorld(io, matchId, keyToRemove, spawnablesToAdd)
{
    if(keyToRemove !== -1)
        global.matches[matchId].spawnablesArray.splice(keyToRemove, 1);

    for(var spawnable in spawnablesToAdd)
        global.matches[matchId].spawnablesArray.push(spawnablesToAdd[spawnable]);

    io.to(String(matchId)).emit("matchExt", "spawnablesUpdate", [keyToRemove, spawnablesToAdd]);
}

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
