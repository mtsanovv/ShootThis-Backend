var mysql = require('mysql2');
var config = require('../config.json');
var logger = require('./logger.js');
var errorHandler = require('./unhandledError.js');

class Database
{
    constructor()
    {
        this.host;
        this.user;
        this.password;
        this.database;
        this.testSQL;
        this.connection;
        this.connectionSuccessful = false;
    }

    init() 
    {
        this.host = config.database.host;
        this.user = config.database.username;
        this.password = config.database.password;
        this.database = config.database.dbname;
        this.testSQL = config.database.testSQL;

        this.connect();
    }

    connect() 
    {
		if(this.host == null || this.user == null || this.password == null || this.database == null || this.testSQL == null)
            errorHandler.criticalError(new Error("Improper MySQL configuration"));

		this.connection = mysql.createPool({
            connectionLimit: global.serverDetails.dbConnections,
			host: this.host,
			user: this.user,
			password: this.password,
			database: this.database
		});

        this.testConnection();
        
		delete this.host;
		delete this.user;
		delete this.password;
		delete this.database;
    }
    
    executeQuery(query, args, callback, overrideFatal = false)
    {
        this.connection.getConnection(function (err, conn) {
            if(err)
            {
                if(typeof c !== 'undefined') c.release();
                if(!overrideFatal) errorHandler.logFatal(err);
                if(typeof callback == 'function') callback(err, null, null);
            }
            else
            {
                conn.execute(query, args, function(err, results, fields)
                {
                    conn.release();

                    if(err)
                        logger.log("Query error: " + err.toString(), "w");
                    
                    if(typeof callback == 'function') callback(err, results, fields);
                });
            }
        });
    }

    testConnection() 
    {
        this.executeQuery(this.testSQL, [], function(error, results, fields) {
            if(error !== null && typeof error !== 'undefined')
                errorHandler.criticalError(error);
        }, true);
    }

    /*
    one SHOULD ALWAYS PREPARE THEIR STATEMENTS
    https://www.npmjs.com/package/mysql2#using-prepared-statements
    executeQuery should always be used to execute queries as it prepares statements inside it
    */

    //begin game-specific functions

    getColumnById(id, column, callback) 
    {
        var query = "SELECT " + column + " FROM `users` WHERE id = ?";

        this.executeQuery(query, [id], function(error, results, fields) {
            if(error || !results.length)
                return callback(true);
            else
                return callback(false, results[0][column]);
        });
    }

    updateColumnById(id, column, value, callback = (error) => {}) 
    {
        var query = "UPDATE `users` SET " + column + " = ? WHERE `id` = ?";

        this.executeQuery(query, [value, id], function(error, results, fields) {
            if(error)
                return callback(true);
            else
                return callback(false);
        });
    }

    getColumnByUsername(username, column, callback) 
    {
        var query = "SELECT username, " + column + " FROM `users` WHERE `username` LIKE ?";

        this.executeQuery(query, [username], function(error, results, fields) {
            if(error || !results.length)
                return callback(true);
            else
                return callback(false, results[0]["username"], results[0][column]);
        });
    }

    getColumnsByUsername(username, columns, callback) 
    {
        var query = "SELECT username, " + columns.join(", ") + " FROM `users` WHERE `username` LIKE ?";

        this.executeQuery(query, [username], function(error, results, fields) {
            if(error || !results.length)
                return callback(true);
            else
                return callback(false, results[0]);
        });
    }

    updateColumnByUsername(username, column, value, callback = (error) => {}) 
    {
        var query = "UPDATE `users` SET " + column + " = ? WHERE `username` LIKE ?";

        this.executeQuery(query, [value, username], function(error, results, fields) {
            if(error)
                return callback(true);
            else
                return callback(false);
        });
    }

    joinedWorldByUsername(username, ip, callback = (error) => {}) 
    {
        var query = "INSERT INTO `loginhistory` (`id`, `username`, `time`, `world`, `ip`) VALUES (NULL, ? , current_timestamp(), ? , ?); ";

        this.executeQuery(query, [username, global.serverId, ip], function(error, results, fields) {
            if(error)
                return callback(true);
            else
                return callback(false);
        });
    }
}

module.exports = Database;
