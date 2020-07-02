var config = require('../../config.json');
var Database = require('./database.js');
var errorHandling = require('./unhandledError.js');

var mysql;

function init() 
{
	mysql = new Database();
	mysql.init();
}

function getDb()
{
	return mysql;
}

module.exports.init = init;
module.exports.getDb = getDb;