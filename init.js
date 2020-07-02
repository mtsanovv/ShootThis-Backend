var params = process.argv;
var config = require('./config.json');
var logger = require('./util/logger.js');
var cluster = require('./util/cluster.js');

global.serverId;
global.serverDetails;
global.origins = [];
global.players = [];

if(params.length != 3)
  return console.log("Improper parameters specified. Please start the server like this: 'node init.js serverKey' ");
 

var serverData = config["servers"][params[2]];

if(!serverData)
{
  var message =  "Invalid server. Available servers are: ";
  for(var i in config["servers"])
    message += i + " ";
  return console.log(message);
}

global.serverId = params[2];
global.serverDetails = serverData;

for(var origin in config["origins"])
  for(var port in config["origins"][origin].ports)
    global.origins.push(config["origins"][origin].protocol + origin + ":" + config["origins"][origin]["ports"][port]);

cluster.init();