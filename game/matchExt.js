var logger = require('../util/logger.js');
var bcrypt = require('bcryptjs');

/* 
matchExt HANDLERS:
*/

/*
matchExt RESPONSES:
*/

function handleMatchPacket(player, requestType, args)
{
    switch(requestType)
    {
        default:
            logger.log("Invalid gameExt handler: " + requestType, 'w');
            break;
    }
}

module.exports.handleMatchPacket = handleMatchPacket;
