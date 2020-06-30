var params = process.argv;
var config = require('./config.json');



if(params.length != 3)
  return console.log("Improper parameters specified. Please start the server like this: 'node init.js serverKey' ");
 

var serverData = config["servers"][params[2]];

if(serverData)
{
  global.serverId = params[2];
  global.serverSpecs = serverData;
}
else
{
  var message =  "Invalid server. Available servers are: ";
  for(var i in config["servers"])
    message += i + " ";
  return console.log(message);
}
  
/*var io = require('socket.io')();

io.origins(["*:*"]);
io.on('connection', client => {
  console.log("user connected");
  client.on('disconnect', () => { console.log("user disconnected"); });
});
io.listen(9903);*/
console.log("ShootThis-Backend running " + params[2] + " on port " + serverData["port"]);