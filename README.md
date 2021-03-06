# ShootThis-Backend

A 2D HTML5 battle royale, using the [Phaser 3](https://github.com/photonstorm/phaser/) engine.

This is the backend server, written for **Node.js version 12.18.1**. The database engine used in the creation process is MariaDB. The storage engine used is InnoDB.

**Please note that this is the backend version, the backbone of [ShootThis-Web](https://github.com/mtsanovv/ShootThis-Web).**

**The external tools besides the image, code and audio editing software used in the creation process are located in [ShootThis-Tools](https://github.com/mtsanovv/ShootThis-Tools).**

## Demos

- Trailer: https://www.youtube.com/watch?v=CnBwuOsRmqI
- Beta gameplay (from the early playtests): https://www.youtube.com/watch?v=5GN0ucv-P44
- Final gameplay: https://www.youtube.com/watch?v=sRgesXdogjc

## Instructions

Before you begin, you need to have a MySQL/MariaDB server running (as well as a web server to access the actual game). For testing purposes, if you cannot setup a MySQL/MariaDB server and/or a web server, use [XAMPP](https://www.apachefriends.org/download.html). We have used it to test the game on our personal Windows PCs, for the playtests we used an Ubuntu server and installed manually mysql-server and nginx.

*Assuming you have* ```npm``` *and Node.js installed:*
1. Install redis-server if you don't have it.
2. Run ```npm install socket.io mysql2 socket.io-redis bcryptjs intersects lodash optimized-quicksort chalk```
3. You may need to set up a new database using the shootthis.sql file (that's only if you haven't done it for the frontend already).
4. It is recommended that you set up a new database user that can access only the newly created database. Make sure to adjust its parameters such as max connections per hour and max user connections to allow enough DB connections for each server.
5. Edit the configuration in config.json:
	- "errorCodes" are the error codes that the application may use
	- "originsEnabled" is the option that enables or disables allowed hosts (see "origins" below). **By default it is set to TRUE. If you get connection errors, check if disabling this option and restarting the server will fix the issue - if it does, you have misconfigured the origins below. Disabling this option allows ANY HOST to connect to the server.**
	- "origins" are the allowed hosts with their respective ports (80, 443 usually)
	- "redis" is the configuration for the redis-server
	- "database" are the database details for the main database
	- "servers" are the servers that can be started. The available types of servers are "login" and "game". An example has already been done. **Please note that if you run the different servers on different datacenters, all of them should have the same config.json.** Additionally, dbConnections is the size of the connection pool. Multiply that number by the number of threads on your system to figure out how many connections will be created (that's per server).
	- "gameConfig" are configurations for the game itself (i.e. max match length, players per match etc.)
	- "hints" are the game hints
	- "wallTiles" are the configurations for the horizontal and vertical tiles of the game borders (which are walls as assets)
	- "obstacles" are the configurations for the different obstacles that are spawned around the map
	- "spawnables" are the configurations for the different items that spawn around the map
	- "weapons" are the configurations for weapons (currently only 1)
	- "characters" is the configuration for all the characters, available in-game
6. Run redis-server.
7. To start one of the servers on the current machine, use ```node init.js serverKey```. For example, ```node init.js login1```.
8. To start more than one server, simply open another Terminal and perform step 7 again for the other server.
9. **There is the chance of having bruteforce attempts on login. Thus, you need to set up a firewall filtering packets on login and game server as well.**

## Important notes
```diff 
- By default, the client-server connection is configured as http, which is EXTREMELY insecure BECAUSE PASSWORDS ARE SENT IN PLAINTEXT. ALWAYS USE HTTPS WHENEVER SENDING PLAINTEXT PASSWORDS!
```

**For using secure (https) connections for the ShootThis-Backend servers, please refer to the [SSL configuration for ShootThis-Backend servers](README-SSL.md)**.

- There was an intention to create a system that locks out the user after failing X login attempts. However, this is ineffective as it may be easily voided or may prevent the actual user from logging in. **This is why the best solution to the issue of eventual bruteforce is to set up some firewall rules.** ConfigServer Firewall (CSF) for some Linux distros has some useful perks for this, such as limiting connections that can be created from an IP per time period and number of connections that can be opened on a specific port per time period. Read more here: https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-config-server-firewall-csf-on-ubuntu
- The SQL file included contains the structure of the database that is used for ShootThis **and it is required by both the frontend and the backend.**
- There may be stutter when moving sometimes. This means that either you cannot exchange data with the server fast enough or the server cannot process the data fast enough. During initial playtests, the original server (512 MB RAM, 2.5 GHz 4-core Xeon, 100Mbps link speed) we had was facing this issue. We upgraded to a 1GB RAM, 2.5 GHz 4-core Xeon with 1Gbps link speed and it did well.

## Authors
- Web Design: M. Tsanov
- Game Design: S. Tsvetkov
- Artwork: M. Tsanov, S. Tsvetkov
- Backend: M. Tsanov, Y. Berov

*M. Tsanov, S. Tsvetkov, Y. Berov, 2020*
