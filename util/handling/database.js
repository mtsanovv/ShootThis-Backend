var mysql = require('mysql2');
var config = require('../../config.json');
var logger = require('../logger.js');
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
        this.pools;
    }

    init() 
    {
        this.host = config.database.host;
        this.user = config.database.username;
        this.password = config.database.password;
        this.database = config.database.dbname;
        this.testSQL = config.database.testSQL;

        this.pools = global.serverDetails.dbConnections;

        this.connect();
    }

    connect() 
    {
		if(this.host == null || this.user == null || this.password == null || this.database == null || this.testSQL == null)
            errorHandler.criticalError(new Error("Improper MySQL configuration"));

		this.connection = mysql.createPool({
            connectionLimit: this.pools,
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
    
    executeQuery(query, args, callback)
    {
        this.connection.getConnection(function (err, conn) {
            if(err)
            {
                if(c !== undefined) c.release();
                errorHandler.logFatal(e);
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
            if(error !== null)
                errorHandler.criticalError(error);
        });
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
            return callback(results[0][column]);
        });
    }

    getColumnByUsername(username, column, callback) 
    {
        var query = "SELECT `username`, " + column + " FROM `users` WHERE `username` LIKE ?";

        this.executeQuery(query, [username], function(error, results, fields) {
            return callback(results[0]["username"], results[0][column]);
        });
    }
}

module.exports = Database;
