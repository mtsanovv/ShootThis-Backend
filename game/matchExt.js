var logger = require('../util/logger.js');
var config = require('../config.json');

/* 
matchExt HANDLERS:
*/

/*
matchExt RESPONSES:
*/

function handleMatchPacket(io, player, requestType, args)
{
    switch(requestType)
    {
        default:
            logger.log("Invalid gameExt handler: " + requestType, 'w');
            break;
    }
}

module.exports.handleMatchPacket = handleMatchPacket;
