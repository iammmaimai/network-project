const moment = require('moment')

function formatMessage(username,text) {
    return {
        username,
        text,
        time: new Date().toISOString() //hour minute am/pm
    }
}

module.exports = formatMessage