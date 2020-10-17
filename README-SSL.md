# SSL configuration for ShootThis-Backend servers
Some extra steps are required to get ShootThis to work over a secure connection (and we're not talking about the web page, rather the connection to the servers).

## Introduction

Originally, when we started work on the network part of the game, we never considered in-depth the SSL component. It was mostly a testing phase and we couldn't even test it properly. However, when we bought the playtest servers we got to test this and things weren't as straightforward as we thought initially. The SSL connection actually has to be established with a proxy server and then that server to pass all the requests to ShootThis-Backend. Since we had nginx to serve our web pages (and we had SSL set up on that) and it actually can be used as a proxy server, we went for that. This tutorial explains how to set up some settings for SSL in ShootThis-Backend and most importantly, **how to set up the proxy server for ShootThis-Backend in nginx**. It is harder than the setup of the game itself and if you're to use ShootThis **for testing/demo purposes only**, it is fine to stick to http.

## Requirements

- Your certificate files (the same you need to set up SSL for a regular nginx web server);
- Knowledge of how to set up those certificates;
- A domain (optional) - most certificates (for example, from Let's Encrypt) require you to set them up on a domain.

## Instructions

*Assuming you have nginx installed and you have basic knowledge of its structure and the ways to configure it:*
1. You need a few server blocks for your domain in a specific file in the sites-available and the sites-enabled nginx config folders (usually there's a symlink to the sites-available file in the sites-enabled folder). For the sake of making this tutorial less overwhelming, you can put everything inside the default file that is already set up.
2. Now, you don't really need to have nginx handling your actual web server on port 443, you can have, let's say, Apache doing that. Your web server and game servers may not be even on the same server (and that's the recommended ShootThis setup). However, we already had a certificate and a running nginx web server lying around as mentioned previously, so we just put everything on the same server. **All your functional ShootThis-Backend servers have to be using the http protocol and need to have their IPs set to their respective host servers' IPs.**
It is important to note now that we were using a server with an IP 5.206.227.98 and the domain shootthis.tk, both active at the time of writing this. This server had Ubuntu 18.04 installed on it and acted both as a web server and as a host server for 2 ShootThis-Backend servers (login1 and game1). Our certificates were generated automatically by certbot (with the plugin python-certbot-nginx) - that is Let's Encrypt Authority X3. We didn't really need to set up the files or specify any paths, after the certificates are generated certbot sets them up for you. Our login1 server was with IP 5.206.227.98 on port 9907, listening for **http** connections. Our game1 server was with IP 5.206.227.98 on port 9909, listening for **http** connections, **with showInServerList property set to false and isDummy property set to false**, more on that later. The proxy was the domain shootthis.tk and the proxy https ports were 8807 and 8809, respectively.
3. You need to set up the server blocks to act as proxy for login servers. Unfortunately, we couldn't figure out any better way to have the ports to be dynamically forwarded, so all we have are different server blocks for each ShootThis-Backend server. Here is an example of our server block, acting as proxy for login1:
```
server {	
	listen 8807 ssl;
	listen [::]:8807 ssl;

	autoindex off;

	server_name shootthis.tk;
	
	location /socket.io {
		
		proxy_pass http://127.0.0.1:9907;
		proxy_http_version 1.1;
		proxy_redirect off;
		proxy_buffering off;

		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "Upgrade";
    }

    ssl_certificate /etc/letsencrypt/live/shootthis.tk/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/shootthis.tk/privkey.pem; # managed by Certbot

}
```
Basically, your server block has to bind (listen to) a port that's not used and we'll call it the "public" port - the ShootThis-Backend login server doesn't actually listen to this. We need the proxy_pass parameter to pass the data to the game - note the http protocol used. 127.0.0.1 is the IP where that login server runs (in our case on the same host server) and 9907 is the actual port that the login server uses. The ssl_certificate and ssl_certificate_key parameters are mandatory as they are the ones serving the certificate, but that's out of the scope of this tutorial.

After you have created a server block for one login server, you need to create more for all the other login servers (that is, if you have more than one). Now, in [ShootThis-Web](https://github.com/mtsanovv/ShootThis-Web) you need to edit the config.js file. There, as mentioned, all login servers should be ordered by priority, but let us make this clear: **the servers that go there SHOULD NOT be the actual IPs and ports of the actual ShootThis-Backend login servers, they should rather be the proxies**.

To sum it up, for our login server at that point we had the actual ShootThis-Backend login1 server running on http://5.206.227.98:9907 and the proxy on https://shootthis.tk:8807. Here's an example of what went into our config.js file in [ShootThis-Web](https://github.com/mtsanovv/ShootThis-Web):
```
var loginConfig = {
	//make sure that this is valid (like JSON) and has the right parameters or you can run into some nasty errors
	//logins are sorted by priority (most reliable servers on top)
	//IMPORTANT! - all login servers should be like login1, login2 etc., where 1, 2, 3 are unique CONSEQUENT numbers
	"login1": {
		"address": "//shootthis.tk",
		"port": 8807,
		"protocol": "https:"
	}
};
```
4. You need to set up the server blocks to act as proxy for game servers. Here is an example of our server block, acting as proxy for game1: 
```
server {	
	listen 8809 ssl;
	listen [::]:8809 ssl;

	autoindex off;

	server_name shootthis.tk;
	
	location /socket.io {
		
		proxy_pass http://127.0.0.1:9909;
		proxy_http_version 1.1;
		proxy_redirect off;
		proxy_buffering off;

		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "Upgrade";
    }

    ssl_certificate /etc/letsencrypt/live/shootthis.tk/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/shootthis.tk/privkey.pem; # managed by Certbot

}
```

The configuration is exactly the same as the login server, only the port numbers are different. Our actual ShootThis-Backend game1 game server is running on http://5.206.227.98:9909 and the proxy is https://shootthis.tk:8809. After you have created a server block for one login server, you need to create more for all the other login servers (that is, if you have more than one). Now, you need to edit config.json in ShootThis-Backend. You shouldn't add the proxy server as a separate ShootThis-Backend server for the login servers, but you have to do so for the game servers. We already had game1 occupied by the actual game server (**we made sure showInServerList and isDummy are set to false** for game1) and so we created game2 (a dummy game server for the proxy server) as follows:
```
"game4": {
    "protocol": "https:",
    "publicAddress": "//shootthis.tk",
    "port": 8809,
    "type": "game",
    "showInServerList": true,
    "isDummy": true
}
```
Please note that this, being the proxy server has **showInServerList and isDummy are set to true**. It has no name, it just has the specified parameters above because, again, this is a dummy game server. **When you have a server that's not a dummy, that doesn't necessarily mean showInServerList should be set to false, especially if you use http it has to be set as true.**

In the end, our servers configuration in config.json looked like this:

```
"login1": {
    "address": "5.206.227.98",
    "port": 9907,
    "displayName": "Login Server",
    "protocol": "http:",
    "maxUsers": 1000,
    "dbConnections": 50,
    "type": "login"
},
"game1": {
    "address": "5.206.227.98",
    "publicAddress": "//5.206.227.98",
    "port": 9909,
    "displayName": "Lisbon, PT",
    "protocol": "http:",
    "maxUsers": 450,
    "dbConnections": 20,
    "type": "game",
    "showInServerList": false,
    "isDummy": false
},
"game2": {
    "protocol": "https:",
    "publicAddress": "//shootthis.tk",
    "port": 8809,
    "type": "game",
    "showInServerList": true,
    "isDummy": true
}
```
5. Now, you need to check how the origins are set up - we're still working with config.json. First, check if originsEnabled is set to true (it is by default). You need to edit the origins that are allowed to access ShootThis to be only 1 - and that's the webpage that uses https. We had the web server running on https://shootthis.tk (that is https://shootthis.tk:443) and so that is our only origin for allowed connections:
```
"origins": {
    "//shootthis.tk": {
        "ports": ["443"],
        "protocol": "https:"
    }
}
```
6. Everything should be good to go at this point. If you have started the login servers, you need to need to restart them to have the config.json changes working upon login. However, the game servers may be a little confusing - which one to start - the ShootThis-Backend game server or the dummy game server (in our case, game1 or game2)? The answer is that the dummy server is there only to be sent as an available server when the user logs in - hence why it has showInServerList set to true and the ShootThis-Backend game server has that set to false. In other words, you still start the actual game server - and that in our case is game1. **Even though game2 is an unique server key (game2 in our case, of course, it may be anything in your), it cannot to be started**.

We've done our best to make it all as flexible as possible - you can have separate host servers for the proxy server, for the web server and for all login and game servers, you just need to set up the configuration and that's mostly on nginx's end. Here's a good tutorial on [how to have a separate host servers for the proxy server and the ShootThis-Backend servers, with the proxy server passing data to them](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/). In reality, you just add the proxy_bind parameter and configure the proxy_pass properly, but that's again out of the scope of this tutorial.

*M. Tsanov, 2020*