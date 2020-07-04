var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');

/* 
LOGIN HANDLERS:
    cc => handleCheckCookie
    pl => handlePlayerLogin
*/

/*
LOGIN SERVER RESPONSES:
    slFail => saved login failure to authenticate
    lFail => login failure to authenticate user
    ls => login successful, args: encrypted loginToken
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
            logger.log("Invalid handler (request type): " + requestType, 'w');
            break;
    }
}

function handleCheckCookie(player, args)
{
    player.database.getColumnByUsername(args[0], 'savedLoginCookie', (err, username, savedLoginCookie) => {
        if(err)
        {
            bcrypt.compare(savedLoginCookie, args[1], function(err, res) {
                if(res === true)
                {
                    //generate a new random string, store it in db and send it to user
                    //then initiate login sequence
                }
                else
                    player.socket.emit("loginExt", "slFail");
            });
        }
        else
            player.socket.emit("loginExt", "slFail");
    });
}

function handlePlayerLogin(player, args)
{
    logger.log("login request from " + args[0] + " password " + args[1] + " saveAccount: " + args[2]);
    player.socket.emit("loginExt", "lFail");
}

module.exports.handleConnection = handleConnection;
module.exports.handleLoginRequest = handleLoginRequest;