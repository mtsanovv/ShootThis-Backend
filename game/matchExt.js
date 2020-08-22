var logger = require('../util/logger.js');
var config = require('../config.json');
var intersects = require('intersects');

/* 
matchExt HANDLERS:
    matchOk => handleJoinMatchOk
    rotatePlayer => handleRotatePlayer
    movePlayer => handleMovePlayer
*/

/*
matchExt RESPONSES:
    matchStarted => respond with an object, consisting of all players
    leaveMatch => the user is forced to leave to lobby
    matchFail => everybody has left the match
    playerLeft => respond with the player id that left
    startMatch => match starts with the parameters given
    focusedPlayer => id of focused player
    playerRotated => respond with the rotation parameter for the given player
    playerMoved => respond with the new x, y and rotation for the given player
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

    var obstaclesToSpawn = integerInInterval(config.gameConfig.minObstacles, config.gameConfig.maxObstacles);
    var rectanglesToCheckAgainst = [];

    for(var i = 0; i < obstaclesToSpawn; i++)
    {
        var obstacleType = integerInInterval(0, Object.keys(config.obstacles).length); //generates a number in the interval [min, max) so it's fine to use the length
        var width = config.obstacles[String(obstacleType)].matchWidth;
        var height = config.obstacles[String(obstacleType)].matchHeight;
        var x = integerInInterval(0 + width, config.gameConfig.gameWidth - width);
        var y = integerInInterval(0 + height, config.gameConfig.gameHeight - height);

        for(var j = 0; j < rectanglesToCheckAgainst.length; j++)
        {
            var isIntersecting = intersects.boxBox(x, y, width, height, rectanglesToCheckAgainst[j][0], rectanglesToCheckAgainst[j][1], rectanglesToCheckAgainst[j][2], rectanglesToCheckAgainst[j][3]);
            if(isIntersecting)
            {
                x = integerInInterval(0 + width, config.gameConfig.gameWidth - width);
                y = integerInInterval(0 + height, config.gameConfig.gameHeight - height);
                j = -1;
            }
        }
        rectanglesToCheckAgainst.push([x, y, width, height]);
        global.matches[matchId].obstaclesArray.push({type: obstacleType, x: x, y: y});
    }

    //fill spawnables array

    for(var socket in global.matches[matchId].connected)
    {
        var playerSocket = global.matches[matchId].connected[socket];
        var player = await getPlayerBySocket(playerSocket);
        if(player)
        {
            //when generating coordinates, check if they overlap with anything else before in a do/while
            var width = config.obstacles[String(player.playerData.character)].matchWidth;
            var height = config.obstacles[String(player.playerData.character)].matchHeight;
            var x = integerInInterval(0 + width, config.gameConfig.gameWidth - width);
            var y = integerInInterval(0 + height, config.gameConfig.gameHeight - height);
            //maybe should've used let for x, y, width and height as well as j, but that would create some other problems that have to be fixed
            for(var j = 0; j < rectanglesToCheckAgainst.length; j++)
            {
                //despite the fact that x and y are centers of a circle,  we can still calculate the initial x and y of the original player box before they are spawned to ensure that there are no collisions
                var isIntersecting = intersects.boxBox(x - width / 2, y - height / 2, width, height, rectanglesToCheckAgainst[j][0], rectanglesToCheckAgainst[j][1], rectanglesToCheckAgainst[j][2], rectanglesToCheckAgainst[j][3]);
                if(isIntersecting)
                {
                    x = integerInInterval(0 + width, config.gameConfig.gameWidth - width);
                    y = integerInInterval(0 + height, config.gameConfig.gameHeight - height);
                    j = -1;
                }
            }
            rectanglesToCheckAgainst.push([x - width / 2, y - height / 2, width, height]);
            global.matches[matchId].playersObject[player.id] = {character: player.playerData.character, x: x, y: y, rotation: 0};
            player.socket.emit("matchExt", "focusedPlayer", [player.id]);
        }
        else
            global.matches[matchId].connected[socket].emit("matchExt", "matchFail");
    }
    
    io.to(String(matchId)).emit("matchExt", "startMatch", [config.gameConfig.cameraBoundX, config.gameConfig.cameraBoundY, global.matches[matchId].playersObject, global.matches[matchId].obstaclesArray, global.matches[matchId].spawnablesArray, config.gameConfig.gameWidth, config.gameConfig.gameHeight]);
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
    if((now - player.lastActions.lastMoved) > config.gameConfig.timeBetweenMovement && Object.keys(global.matches[player.matchId].playersObject).indexOf(String(player.id)) !== -1)
    {
        player.lastActions.lastMoved = now;
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
    //checks also for overlapping other objects etc
    //for now it's only checking for world boundaries

    var playerRadius = config.characters[String(player.playerData.character)].matchWidth;
    if(config.characters[String(player.playerData.character)] > playerRadius)
        playerRadius = config.characters[String(player.playerData.character)].matchHeight;
    
    for(var playerId in global.matches[player.matchId].playersObject)
    {
        var enemyRadius = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchWidth;
        if(config.characters[String(global.matches[player.matchId].playersObject[playerId].character)] > enemyRadius)
            enemyRadius = config.characters[String(global.matches[player.matchId].playersObject[playerId].character)].matchHeight;

        if(playerId != player.id)
        {
            var isIntersecting = intersects.circleCircle(x, y, playerRadius / 2, global.matches[player.matchId].playersObject[playerId].x, global.matches[player.matchId].playersObject[playerId].y, enemyRadius / 2);
            if(isIntersecting)
                return false;
        }
    }

    for(var obstacleKey in global.matches[player.matchId].obstaclesArray)
    {
        var obstacle = global.matches[player.matchId].obstaclesArray[obstacleKey];
        var hitbox = scaleHitboxToReal(obstacle.x, obstacle.y, config.obstacles[String(obstacle.type)].matchWidth, config.obstacles[String(obstacle.type)].matchHeight, config.obstacles[String(obstacle.type)].hitbox);
        for(var polygon in hitbox)
        {
            var isIntersecting = intersects.circlePolygon(x, y, playerRadius / 2, hitbox[polygon]);
            if(isIntersecting)
                return false;
        }
    }

    if(x < 0 || x > config.gameConfig.gameWidth || y < 0 || y > config.gameConfig.gameHeight)
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

module.exports.handleMatchPacket = handleMatchPacket;
module.exports.startMatch = startMatch;
module.exports.playerLeft = playerLeft;
