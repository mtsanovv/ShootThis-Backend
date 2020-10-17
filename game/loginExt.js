var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');
var crypto = require('crypto');
var config = require('../config.json');

/* 
loginExt HANDLERS:
    cc => handleCheckCookie
    pl => handlePlayerLogin
*/

/*
loginExt RESPONSES:
    slFail => saved login failure to authenticate
    lFail => login failure to authenticate user
    sCookie => save login cookie 
    ls => login successful, args: username, encrypted loginToken, servers list
*/


function handleConnection(player)
{
    player.socket.emit("loginExt", "connectionSuccessful");
}

function handleLoginRequest(player, requestType, args)
{
    switch(requestType)
    {
        case "cc":
            handleCheckCookie(player, args);
            break;
        case "pl":
            handlePlayerLogin(player, args);
            break;
        default:
            logger.log("Invalid loginExt handler: " + requestType, 'w');
            break;
    }
}

function handleCheckCookie(player, args)
{
    player.database.getColumnsByUsername(args[0], ["savedLoginCookie", "savedLoginCookieValidUntil"], (err, savedLoginCookieArr) => {
        if(!err)
        {
            if(new Date(savedLoginCookieArr["savedLoginCookieValidUntil"]).valueOf() > new Date().valueOf())
            {
                bcrypt.compare(savedLoginCookieArr["savedLoginCookie"], args[1], function(err, res) {
                    if(res === true)
                        handleLoginSuccessful(player, args[0]);
                    else
                        player.socket.emit("loginExt", "slFail");
                });
            }
            else
                player.database.updateColumnByUsername(args[0], "savedLoginCookie", "", (err) => {
                    player.socket.emit("loginExt", "slFail");
                });
        }
        else
            player.socket.emit("loginExt", "slFail");
    });
}

function handlePlayerLogin(player, args)
{
    player.database.getColumnByUsername(args[0], 'password', (err, username, password) => {
        if(!err)
        {
            bcrypt.compare(args[1], password, function(err, res) {
                if(res === true)
                {
                    if(args[2])
                    {
                        crypto.randomBytes(48, function(err, buffer) {
                            var token = buffer.toString('hex');
                            player.database.updateColumnByUsername(args[0], "savedLoginCookie", token, (err) => {
                                var date = new Date((new Date()).getTime() + 60*24*60*60*1000);
		                        var nowDate = date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2) + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2);
                                player.database.updateColumnByUsername(args[0], "savedLoginCookieValidUntil", nowDate, (err) => {
                                    bcrypt.genSalt(10, function(err, salt) {
                                        bcrypt.hash(token, salt, function(err, hash) {
                                            player.socket.emit("loginExt", "sCookie", [username, hash]);
                                        });
                                    });
                                });
                            });
                        });
                    }
                    handleLoginSuccessful(player, username);
                }
                else
                    player.socket.emit("loginExt", "lFail");
            });
        }
        else
            player.socket.emit("loginExt", "lFail");
    });
}

function handleLoginSuccessful(player, username)
{
    crypto.randomBytes(48, function(err, buffer) {
        var token = buffer.toString('hex');
        player.database.updateColumnByUsername(username, "loginToken", token, (err) => {
            var date = new Date((new Date()).getTime() + 10*60*1000);
            var nowDate = date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2) + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2);
            player.database.updateColumnByUsername(username, "loginTokenExpiry", nowDate, (err) => {
                bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(token, salt, function(err, hash) {
                        var serverList = [];
                        for(var server in config["servers"])
                        {
                            if(config["servers"][server].type == "game" && config["servers"][server].showInServerList)
                                serverList.push(config["servers"][server].protocol + config["servers"][server].publicAddress + ":" + config["servers"][server].port);
                        }
                        player.socket.emit("loginExt", "ls", [[username, hash], serverList]);
                    });
                });
            });
        });
    });
}

function handleDisconnection(socket)
{
    for(var player = 0; player < global.players.length; player++)
        if(global.players[player].socket == socket)
            global.players.splice(player, 1);
    logger.log("User disconnected");
}

module.exports.handleConnection = handleConnection;
module.exports.handleLoginRequest = handleLoginRequest;
module.exports.handleDisconnection = handleDisconnection;