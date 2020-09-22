var Database = require('./database.js');

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