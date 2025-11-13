const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages')
const {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
    getAllUsers
} =require('./utils/users');

const {
    createGroup,
    getAllGroups,
    getGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    isMemberOfGroup,
    deleteGroup,
    getUserGroups
} = require('./utils/groups');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

//set static folder
app.use(express.static(path.join(__dirname,'public'))); //dirname = current directory 

const botName = "Chatcord HR"

//Run when client connect 
io.on('connection', socket =>{
    
    socket.on('joinRoom', ({username,room}) =>{

        const { error, user } = userJoin(socket.id, username, room);
        if (error) {
            // 3. Send an error event back to the client and STOP
            return socket.emit('joinError', error);
        }
        socket.join(user.room);
        //Welcome current user
        socket.emit('message', formatMessage(botName , 'Welcome to chatcord')) // emit = only show to the user that login 
    
        //Broadcast when a user connect 
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage(botName, ` ${user.username} has joined the chat`)) // broadcast.emit = show to everone execpt the user who logging in 

        io
            .to(user.room)
            .emit('roomUsers', {
                room:user.room,
                users:getRoomUsers(user.room)
            })
    })
    
    //Listen for chatMessage
    socket.on('chatMessage', msg =>{
        const user = getCurrentUser(socket.id)
        io
            .to(user.room)
            .emit('message',formatMessage(user.username,msg))
    })

     //Run when the client disconnect 
    socket.on('disconnect', () =>{
        const user = userLeave(socket.id)

        if (user){
            io
                .to(user.room)
                .emit('message', formatMessage(botName ,` ${user.username} has left the chat`)) //show to every user
            
            io
                .to(user.room)
                .emit('roomUsers', {
                    room:user.room,
                    users:getRoomUsers(user.room)
                })        
        }
    })

    // Handle private message request
    socket.on('requestPrivateChat', ({ targetUserId }) => {
        const sender = getCurrentUser(socket.id);
        const receiver = getCurrentUser(targetUserId);
        
        if (sender && receiver) {
            // Create a unique room ID for this DM (sorted to ensure consistency)
            const dmRoomId = [sender.id, receiver.id].sort().join('-');
            
            // Notify both users about the DM room
            socket.emit('privateChatReady', {
                dmRoomId,
                otherUser: { id: receiver.id, username: receiver.username }
            });
            
            io.to(targetUserId).emit('privateChatReady', {
                dmRoomId,
                otherUser: { id: sender.id, username: sender.username }
            });
        }
    });

    // Handle private messages
    socket.on('privateMessage', ({ dmRoomId, message }) => {
        const sender = getCurrentUser(socket.id);
        
        if (sender) {
            // Extract both user IDs from the dmRoomId
            const userIds = dmRoomId.split('-');
            
            // Send to both participants
            userIds.forEach(userId => {
                io.to(userId).emit('privateMessageReceived', {
                    dmRoomId,
                    message: formatMessage(sender.username, message),
                    senderId: sender.id
                });
            });
        }
    });

    // Get all online users (for DM list)
    socket.on('getAllUsers', () => {
        const currentUser = getCurrentUser(socket.id);
        if (currentUser) {
            const allUsers = getAllUsers()
                .filter(u => u.id !== socket.id)
                .map(u => ({ id: u.id, username: u.username, room: u.room }));
            
            socket.emit('allUsersList', allUsers);
        }
    });
    // Create a new group
    socket.on('createGroup', ({ groupName }) => {
        const user = getCurrentUser(socket.id);
        
        if (user && groupName.trim()) {
            const group = createGroup(groupName, user.id, user.username);
            
            // Join the socket to the group room
            socket.join(group.id);
            
            // Notify creator
            socket.emit('groupCreated', group);
            
            // Broadcast updated group list to all users
            io.emit('groupListUpdated', getAllGroups());
            
            // Send welcome message in the group
            socket.emit('groupMessage', {
                groupId: group.id,
                message: formatMessage(botName, `Welcome to ${group.name}! You are the creator.`)
            });
        }
    });

    // Get all groups
    socket.on('getAllGroups', () => {
        socket.emit('allGroupsList', getAllGroups());
    });

    // Join a group
    socket.on('joinGroup', ({ groupId }) => {
        const user = getCurrentUser(socket.id);
        const group = getGroup(groupId);
        
        if (user && group) {
            // Add user to group
            const added = addMemberToGroup(groupId, user.id, user.username);
            
            if (added) {
                // Join the socket room
                socket.join(groupId);
                
                // Notify user
                socket.emit('groupJoined', group);
                
                // Notify all group members
                io.to(groupId).emit('groupMessage', {
                    groupId,
                    message: formatMessage(botName, `${user.username} joined the group`)
                });
                
                // Update group list for everyone
                io.emit('groupListUpdated', getAllGroups());
            } else {
                socket.emit('groupMessage', {
                    groupId,
                    message: formatMessage(botName, 'You are already a member of this group')
                });
            }
        }
    });

    // Leave a group
    socket.on('leaveGroup', ({ groupId }) => {
        const user = getCurrentUser(socket.id);
        const group = getGroup(groupId);
        
        if (user && group) {
            const removed = removeMemberFromGroup(groupId, user.id);
            
            if (removed) {
                // Leave the socket room
                socket.leave(groupId);
                
                // Notify remaining members
                io.to(groupId).emit('groupMessage', {
                    groupId,
                    message: formatMessage(botName, `${user.username} left the group`)
                });
                
                // Notify user
                socket.emit('groupLeft', { groupId });
                
                // Update group list
                io.emit('groupListUpdated', getAllGroups());
                
                // If group is empty, delete it
                if (group.members.length === 0) {
                    deleteGroup(groupId, group.creator.id);
                    io.emit('groupListUpdated', getAllGroups());
                }
            }
        }
    });

    // Send group message
    socket.on('groupMessage', ({ groupId, message }) => {
        const user = getCurrentUser(socket.id);
        const group = getGroup(groupId);
        
        if (user && group && isMemberOfGroup(groupId, user.id)) {
            io.to(groupId).emit('groupMessage', {
                groupId,
                message: formatMessage(user.username, message)
            });
        }
    });

    // Invite user to group
    socket.on('inviteToGroup', ({ groupId, targetUserId }) => {
        const user = getCurrentUser(socket.id);
        const group = getGroup(groupId);
        const targetUser = getCurrentUser(targetUserId);
        
        if (user && group && targetUser && isMemberOfGroup(groupId, user.id)) {
            io.to(targetUserId).emit('groupInvitation', {
                group,
                inviter: { id: user.id, username: user.username }
            });
        }
    });

    // Delete group (creator only)
    socket.on('deleteGroup', ({ groupId }) => {
        const user = getCurrentUser(socket.id);
        
        if (user) {
            const deleted = deleteGroup(groupId, user.id);
            
            if (deleted) {
                // Notify all members
                io.to(groupId).emit('groupDeleted', { groupId });
                
                // Update group list
                io.emit('groupListUpdated', getAllGroups());
            }
        }
    });

    // Update disconnect to handle group cleanup
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);
        
        if (user) {
            // Handle room disconnect
            io.to(user.room).emit('message', formatMessage(botName, `${user.username} has left the chat`));
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
            
            // Handle group disconnects
            const userGroups = getUserGroups(user.id);
            userGroups.forEach(group => {
                removeMemberFromGroup(group.id, user.id);
                io.to(group.id).emit('groupMessage', {
                    groupId: group.id,
                    message: formatMessage(botName, `${user.username} disconnected`)
                });
            });
            
            // Update group list
            io.emit('groupListUpdated', getAllGroups());
        }
    });
})



//PORT
const PORT = 1573 || process.env.PORT;

server.listen(PORT, () =>{
   console.log( `server running on port ${PORT}`)
});