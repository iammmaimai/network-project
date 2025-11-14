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
const { send } = require('process');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

//set static folder
app.use(express.static(path.join(__dirname,'public'))); //dirname = current directory 

const botName = "PinguHR"

// Helper function to broadcast server stats to all users
function broadcastServerStats() {
    const allUsers = getAllUsers();
    io.emit('serverStats', {
        totalUsers: allUsers.length,
        allUsers: allUsers.map(u => ({ 
            id: u.id, 
            username: u.username, 
            room: u.room,
            group:u.group
        }))
    });
}


//Run when client connect 
io.on('connection', socket =>{
    
    socket.on('joinRoom', ({username,room,group}) =>{

        const { error, user } = userJoin(socket.id, username, room,group);
        if (error) {
            // 3. Send an error event back to the client and STOP
            return socket.emit('joinError', error);
        }
        socket.join(user.room);
        //Welcome current user
        socket.emit('message', formatMessage(botName , 'Welcome to Pingu TALK!')) // emit = only show to the user that login 
    
        //Broadcast when a user connect 
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage(botName, ` ${user.username} has joined the chat`)) // broadcast.emit = show to everone execpt the user who logging in 

        // Send room users to the room
        io
            .to(user.room)
            .emit('roomUsers', {
                room:user.room,
                users:getRoomUsers(user.room)
            })
        
        // Broadcast server stats to ALL users (including the one who just joined)
        broadcastServerStats();
    })

    // Listen for client-side chat context changes
    socket.on('updateUserChatContext', ({ type, name }) => {
        const user = getCurrentUser(socket.id);
        if (user) {
            if (type === 'group'){
                user.group = name;
            } else if (type === 'dm') {
                user.group = "DM with someone";
            } else if (type === 'room') {
                user.group = "Main room";
            }

            broadcastServerStats();
        }
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
            
            // Send updated room users
            io
                .to(user.room)
                .emit('roomUsers', {
                    room:user.room,
                    users:getRoomUsers(user.room)
                })
            
            // Broadcast updated server stats to ALL users
            broadcastServerStats();
            
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
    })

    // Handle private message request
    socket.on('requestPrivateChat', ({ targetUserId }) => {
        const sender = getCurrentUser(socket.id);
        const receiver = getCurrentUser(targetUserId);
        
        if (sender && receiver) {
            // Create a unique room ID for this DM (sorted to ensure consistency)
            const dmRoomId = [sender.id, receiver.id].sort().join('-');
            
            socket.join(dmRoomId);
            io.sockets.sockets.get(receiver.id)?.join(dmRoomId);

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
            io.to(dmRoomId).emit('privateMessageReceived', {
                dmRoomId,
                message: formatMessage(sender.username, message),
                senderId: sender.id
            })
        }
    });

    // Get all online users (for DM list)
    socket.on('getAllUsers', () => {
        const currentUser = getCurrentUser(socket.id);
        if (currentUser) {
            const allUsers = getAllUsers()
                .filter(u => u.id !== socket.id)
                .map(u => ({ id: u.id, username: u.username, room: u.room, group:u.group||null}));
            
            socket.emit('allUsersList', allUsers);
        }
    });
    
    // Get active rooms with user counts (for index.html)
    socket.on('getActiveRooms', () => {
        const allUsers = getAllUsers();
        const roomCounts = {};
        
        allUsers.forEach(user => {
            if (user.room) {
                roomCounts[user.room] = (roomCounts[user.room] || 0) + 1;
            }
        });
        
        socket.emit('activeRooms', roomCounts);
    });
    
    // Get main room count (for index.html)
    socket.on('getMainRoomCount', () => {
        const mainRoomUsers = getRoomUsers('Main Room');
        socket.emit('mainRoomCount', mainRoomUsers.length);
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

            user.group = group.name;
            broadcastServerStats();
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

                user.group = group.name

                io.emit('updateUserGroup', { userId: user.id, groupName: user.group });
                
                // Notify user
                socket.emit('groupJoined', group);
                
                // Notify all group members
                io.to(groupId).emit('groupMessage', {
                    groupId,
                    message: formatMessage(botName, `${user.username} joined the group`)
                });
                
                // Update group list for everyone
                io.emit('groupListUpdated', getAllGroups());

                broadcastServerStats();
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

    socket.on('userGroupUpdated', ({ userId, groupName }) => {
    // Update your server-side user object if needed
    const user = getAllUsers(userId); // your existing user tracking
    if (user) user.group = groupName;

    // Broadcast to all clients that a user updated their group
    io.emit('updateUserGroup', { userId, groupName });
    });
})

//PORT
const PORT = 1573 || process.env.PORT;

server.listen(PORT, () =>{
   console.log( `server running on port ${PORT}`)
});