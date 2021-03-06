var params = process.argv;
var config = require('./config.json');
var cluster = require('./util/cluster.js');

global.serverId;
global.serverDetails;
global.origins = [];
global.players = [];
global.matches = {};

if(params.length != 3)
  return console.log("Improper parameters specified. Please start the server like this: 'node init.js serverKey' ");
 

var serverData = config["servers"][params[2]];

if(!serverData)
{
  var message =  "Invalid server. The available servers are: ";
  for(var i in config["servers"])
  {
    if(!config["servers"][i].isDummy)
      message += i + " ";
  }
  return console.log(message);
}
else if(serverData.isDummy)
{
  var message =  "This is a dummy server and it cannot be started. The available servers are: ";
  for(var i in config["servers"])
  {
    if(!config["servers"][i].isDummy)
      message += i + " ";
  }
  return console.log(message);
}

global.serverId = params[2];
global.serverDetails = serverData;

for(var origin in config["origins"])
  for(var port = 0; port < config["origins"][origin].ports.length; port++)
    global.origins.push(config["origins"][origin].protocol + origin + ":" + config["origins"][origin]["ports"][port]);

cluster.init();