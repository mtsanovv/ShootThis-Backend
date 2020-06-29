var config = require('config.json')
var io = require('socket.io')();
var params = process.argv;

io.origins(["*:*"]);
io.on('connection', client => {
  console.log("user connected");
  client.on('disconnect', () => { console.log("user disconnected"); });
});
io.listen(9903);
console.log("ShootThis-Backend running " + params[2] + " on port 9903");