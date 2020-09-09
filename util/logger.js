function log(message, level)
{
    var date = new Date();
    var loggingMessage = "[" + date.getFullYear() + "-" + ('0' + (date.getMonth() + 1)).slice(-2) + "-" + ('0' + date.getDate()).slice(-2) + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2) + "] ";
    //levels: f - fatal, w - warn, c - critical, default - info
    //critical errors just crash the server

    switch(level)
    {
        case "f":
            loggingMessage += "[FATAL] ";
            break;
        case "w":
            loggingMessage += "[WARN] ";
            break;
        case "c":
            loggingMessage += "[CRITICAL] ";
            break;
        default:
            loggingMessage += "[INFO] ";
            break;
    }

    loggingMessage += message;

    console.log(loggingMessage);

    return loggingMessage;
}

module.exports.log = log;