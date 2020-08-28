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

    //spawn players
    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = await getPlayerBySocket(playerSocket);
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
            global.matches[matchId].playersObject[player.id] = {character: player.playerData.character, x: x, y: y, rotation: 0, centerX: config.characters[String(player.playerData.character)].centerX, centerY: config.characters[String(player.playerData.character)].centerY};
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
    
    io.to(String(matchId)).emit("matchExt", "startMatch", [config.gameConfig.cameraBoundX, config.gameConfig.cameraBoundY, global.matches[matchId].playersObject, global.matches[matchId].obstaclesArray, global.matches[matchId].spawnablesArray, config.gameConfig.gameWidth, config.gameConfig.gameHeight, config.wallTiles.horizontal.height, biggestMagSize]);
    
    //send players data about their weapon config
    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = await getPlayerBySocket(playerSocket);
        if(player)
            player.socket.emit("matchExt", "weaponUpdate", [player.matchData.weapon.loadedAmmo, player.matchData.weapon.ammo, player.matchData.weapon.hopup, player.matchData.weapon.mag, player.matchData.weapon.id, config.weapons[String(player.matchData.weapon.id)].name]);
    }
}

async function getPlayerBySocket(socket)
{
    for(var player in global.players)
    {
        if(global.players[player].socket === socket)
            return global.players[player];
    }
    return null;
}

function handleJoinMatchOk(player)
{
    if(global.matches[player.matchId].players.indexOf(player.socket) !== -1 && global.matches[player.matchId].connected.indexOf(player.socket) === -1)
        global.matches[player.matchId].connected.push(player.socket);
}

function playerLeft(io, player)
{
    if(!global.matches[player.matchId].connected.length && !global.matches[player.matchId].players.length && global.matches[player.matchId].connectionsCheckPassed)
    { 
        delete global.matches[player.matchId];
        return;
    }

    if(global.matches[player.matchId].connected.length)
    {
        io.to(String(player.matchId)).emit("matchExt", "playerLeft", [player.id]);
        //checks for how many people left, if player in playersObject etc
        //REMEMBER THE PLAYER HAS ALREADY BEEN REMOVED FROM THE ROOM, BUT THE OTHERS HAVE TO REMOVE HIM TOO
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
    if((now - player.matchData.lastActions.lastShot) > weaponParameters.timeBetweenFire && (now - player.matchData.lastActions.lastReloaded) > weaponParameters.timeToReload && player.matchData.weapon.loadedAmmo > 0 && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.matchData.lastActions.lastShot = now;
        var bulletX = global.matches[player.matchId].playersObject[player.id].x + ((config.characters[String(player.playerData.character)].bulletOriginX - config.characters[String(player.playerData.character)].centerX) * config.characters[String(player.playerData.character)].matchWidth) * Math.cos(global.matches[player.matchId].playersObject[player.id].rotation);
        var bulletY = global.matches[player.matchId].playersObject[player.id].y + ((config.characters[String(player.playerData.character)].bulletOriginY - config.characters[String(player.playerData.character)].centerY) * config.characters[String(player.playerData.character)].matchHeight) * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation) + ((config.characters[String(player.playerData.character)].bulletOriginX - config.characters[String(player.playerData.character)].centerX) * config.characters[String(player.playerData.character)].matchWidth) * Math.sin(global.matches[player.matchId].playersObject[player.id].rotation);
        io.to(String(player.matchId)).emit("matchExt", "playerShot", [player.id, now, weaponParameters.bulletTravelTime, weaponParameters.bulletTravelDistance, bulletX, bulletY, global.matches[player.matchId].playersObject[player.id].rotation]);
    }
}

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
