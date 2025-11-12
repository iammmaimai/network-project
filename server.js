const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages')
const {userJoin , getCurrentUser, userLeave, getRoomUsers} =require('./utils/users')
const app = express();
const server = http.createServer(app);
const io = socketio(server);

//set static folder
app.use(express.static(path.join(__dirname,'public'))); //dirname = current directory 

const botName = "Chatcord HR"

//Run when client connect 
io.on('connection', socket =>{
    
    socket.on('joinRoom', ({username,room}) =>{

        const user = userJoin(socket.id,username,room)
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
})

//PORT
const PORT = 1573 || process.env.PORT;

server.listen(PORT, () =>{
   console.log( `server running on port ${PORT}`)
});