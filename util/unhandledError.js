var fs = require('fs');
var logger = require('./logger.js');

function init(closeSockets, io) 
{	
	process.on('uncaughtException', logFatal);
	process.on('SIGINT', () => { shutdownServer(closeSockets, io) });
}

function logFatal(error) 
{
    if(typeof(error) == 'object') 
    {
        if(error.message) 
        {	
			var final_message = error;
			
			if(error.stack)
                final_message = error.stack;

            final_message = logger.log(final_message, 'f');
			
			fs.appendFile('error_log.txt', (final_message + "\n"), function(error_str) {
				if(error_str)
					logger.log(error_str, 'f');
            });
            
            //server continues running despite the fatal error
		}
	}
}

function shutdownServer(closeSockets, io)
{
	if(closeSockets) io.close();
	process.exit(0);
}

function databaseError(error)
{
	logger.log('[DATABASE]: ' + error, 'w');
	
	logFatal(error);
}

function criticalError(error) 
{
    if(typeof(error) == 'object') 
    {
        if(error.message) 
        {	
			var final_message = error;
			
			if(error.stack)
                final_message = error.stack;

			final_message = logger.log(final_message, 'c');
			
			fs.appendFileSync('error_log.txt', (final_message + "\n"), function(error_str) {
				if(error_str)
					logger.log(error_str, 'c');
            });
            
			process.exit(1);
			
			//critical errors such as failure to establish a database connection require the server to be shutdown
		}
	}
}

module.exports.init = init;
module.exports.logFatal = logFatal;
module.exports.databaseError = databaseError;
module.exports.criticalError = criticalError;