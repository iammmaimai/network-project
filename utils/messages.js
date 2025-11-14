const moment = require('moment')

function formatMessage(username, messageData) {
    // Handle both old format (string) and new format (object with text/image)
    if (typeof messageData === 'string') {
        return {
            username,
            text: messageData,
            time: new Date().toISOString()
        };
    } else {
        return {
            username,
            text: messageData.text || '',
            image: messageData.image || null,
            time: new Date().toISOString()
        };
    }
}

module.exports = formatMessage