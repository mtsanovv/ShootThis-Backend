var chalk = require('chalk');

function log(message, level)
{
    var date = new Date();
    var messageColor = "#FFFFFF";
    var loggingMessage = "[" + date.getFullYear() + "-" + ('0' + (date.getMonth() + 1)).slice(-2) + "-" + ('0' + date.getDate()).slice(-2) + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2) + "] ";
    //levels: f - fatal, w - warn, c - critical, gi - green info, default - info
    //critical errors just crash the server

    switch(level)
    {
        case "f":
            loggingMessage += "[FATAL] ";
            messageColor = "#FF0000";
            break;
        case "w":
            loggingMessage += "[WARN] ";
            messageColor = "#FF8000";
            break;
        case "c":
            loggingMessage += "[CRITICAL] ";
            messageColor = "#C40000";
            break;
        case "gi":
            loggingMessage += "[INFO] ";
            messageColor = "#23A000";
            break;
        default:
            loggingMessage += "[INFO] ";
            messageColor = "#FFFFFF";
            break;
    }

    loggingMessage += message;

    console.log(chalk.hex(messageColor)(loggingMessage));

    return loggingMessage;
}

module.exports.log = log;