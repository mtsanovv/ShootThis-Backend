var cluster = require('cluster');
var os = require('os');
var config = require('../config.json');
var logger = require('./logger.js');
var network = require('./network.js');
var errorHandling = require('./unhandledError.js');
var dbHandling = require('./databaseInterface.js');

function init() 
{
    if (cluster.isMaster) 
    {
        var io = require('socket.io')();
        var redis = require('socket.io-redis');
        
        io.adapter(redis({ host: config["redis"].host, port: config["redis"].port }));
        
        logger.log("Starting ShootThis-Backend for " + global.serverId + " on " + global.serverDetails.address + ":" + global.serverDetails.port);

        for (var i = 0; i < os.cpus().length; i++)
            cluster.fork();
        
        cluster.on('exit', function(worker, code, signal) {
            logger.log('Worker ' + worker.process.pid + ' died');
        }); 

        errorHandling.init(false, io);
    }
        
    if (cluster.isWorker) 
    {
        var io = require('socket.io').listen(global.serverDetails.port);
        var redis = require('socket.io-redis');
        
        io.adapter(redis({ host: config["redis"].host, port: config["redis"].port }));

        network.init(io);
        errorHandling.init(true, io);
        dbHandling.init();
    }
}

module.exports.init = init;