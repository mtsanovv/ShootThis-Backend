var cluster = require('cluster');
var os = require('os');
var config = require('../config.json');
var logger = require('./logger.js');
var network = require('./network.js');
var errorHandler = require('./unhandledError.js');
var dbHandling = require('./databaseInterface.js');

function init() 
{
    if (cluster.isMaster) 
    {
        var io = require('socket.io')();
        var redis = require('socket.io-redis');
        
        io.adapter(redis({ host: config["redis"].host, port: config["redis"].port }));
        
        logger.log("Starting ShootThis-Backend for " + global.serverId + " on " + global.serverDetails.address + ":" + global.serverDetails.port, 'gi');

        if(config.originsEnabled) 
        {
            logger.log("ATTENTION! Allowed hosts (origins) are ENABLED and if misconfigured, the allowed hosts may not be able to connect to the server.", "w");
            io.origins(global.origins);
        }

        for (var i = 0; i < os.cpus().length; i++)
            cluster.fork();
        
        cluster.on('exit', function(worker, code, signal) {
            if(code === config.errorCodes.ERROR_CRITICAL)
            {
                //121314 is the critical error code
                errorHandler.criticalError({message: "Worker " + worker.process.pid + " has died with code " + code + ", which means that there's a critical error in the code. The app is being terminated for safety measures. Please refer to the logs."});
                process.exit(code);
            }
        }); 

        errorHandler.init(false, io);
    }
        
    if (cluster.isWorker) 
    {
        var io = require('socket.io').listen(global.serverDetails.port);
        var redis = require('socket.io-redis');
        
        io.adapter(redis({ host: config["redis"].host, port: config["redis"].port }));

        io.of('/').adapter.on('error', (err) => {
            errorHandler.criticalError(err);
            // error in the pub/sub means that the workers cannot communicate between each other and
            // the server has to be shut down
            // redis seemed to be pretty stable, during all tests it never threw any errors
        });

        if(config.originsEnabled) io.origins(global.origins);

        network.init(io);
        errorHandler.init(true, io);
        dbHandling.init();
    }
}

module.exports.init = init;