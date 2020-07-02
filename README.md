# ShootThis-Backend

A 2D HTML5 shooter, using the [Phaser 3](https://github.com/photonstorm/phaser/) engine.

This is the backend server, written in Node.js. The database used in the creation process was MariaDB, a fork of MySQL. The storage engine used was InnoDB.

**Please note that this is the backend version, the backbone of [ShootThis-Web](https://github.com/mtsanovv/ShootThis-Web).**

## Instructions

*Assuming you have* ```npm``` *and Node.js installed:*]
1. Install redis-server if you don't have it.
2. Run ```npm install socket.io mysql2 socket.io-redis```
3. You may need to set up a new database using the shootthis.sql file (that's only if you haven't done it for the frontend already).
4. It is recommended that you set up a new database user that can access only the newly created database. Make sure to adjust its parameters such as max connections per hour and max user connections to allow enough DB connections for each server.
5. Edit the configuration in config.json:
	- "origins" are the allowed hosts with their respective ports (80, 443 usually). Change the name of the first one to "\*" and the ports it can access to \["\*"\] in order to allow any host to connect to the server.
	- "redis" is the configuration for the redis-server
	- "database" are the database details for the main database
	- "servers" are the servers that can be started. The available types of servers are "login" and "game". An example has already been done. **Please note that if you run the different servers on different datacenters, all of them should have the same config.json.**
6. Run redis-server.
7. To run one of the servers on the current machine, use ```node init.js serverKey```. For example, ```node init.js login1```.
8. To run more than one server, simply open another Terminal and perform step 7 again for the other server.

## About the SQL file included
This is the structure of the database that is used for ShootThis **and it is required by both the frontend and the backend.**

## Authors
- Web Design: M. Tsanov
- Game Design: S. Tsvetkov
- Graphics Design: M. Tsanov, S. Tsvetkov
- Backend: M. Tsanov, Y. Berov

## Credits
- Socket.IO: https://github.com/socketio
- Server structure ideas, database manager and a few other snippets: https://github.com/HagridHD/Auroris/

*M. Tsanov, S. Tsvetkov, Y. Berov, 2020*
