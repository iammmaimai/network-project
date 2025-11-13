const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
    ignoreQueryPrefix: true,
});

// Global state
window.chatMode = 'room'; // 'room', 'group', or 'dm'
let roomMessages = [];

const socket = io();

// Initialize managers
let groupManager;
let dmManager;

// Join chatroom
socket.emit('joinRoom', { username, room });

// This listens for the error event from the server
socket.on('joinError', (error) => {
    alert(error); // Show the error in a popup
    window.location.href = '/'; // Redirect back to the login page
});

// Get room and users
socket.on('roomUsers', ({ room, users }) => {
    outputRoomName(room);
    outputUsers(users);
});

// Message from server
socket.on('message', message => {
    if (window.chatMode === 'room') {
        outputMessage(message);
        roomMessages.push(message);
    }
});

// Initialize everything after connection
socket.on('connect', () => {
    if (!window.managersInitialized) {
        groupManager = new GroupManager(socket);
        dmManager = new DMManager(socket);
        window.managersInitialized = true;
    }

    // Initialize modals only once
    if (!window.modalsInitialized) {
        initializeModals();
        window.modalsInitialized = true;
    }

    // Load groups (can run every connect)
    groupManager.initialize();
});

// Message submit
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const msg = e.target.elements.msg.value.trim();
    if (!msg) return;

    // Route message based on mode
    if (window.chatMode === 'group') {
        groupManager.sendMessage(msg);
    } else if (window.chatMode === 'dm') {
        dmManager.sendMessage(msg);
    } else {
        socket.emit('chatMessage', msg);
    }

    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    p.innerHTML += `<span>${message.time}</span>`;
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    div.appendChild(para);
    document.querySelector('.chat-messages').appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add room name to DOM
function outputRoomName(room) {
    roomName.innerHTML = `${room} <span class="chat-mode-indicator mode-room">ROOM</span>`;
}

// Add users to DOM
function outputUsers(users) {
    userList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.innerText = user.username;
        li.dataset.id = user.id;
        userList.appendChild(li);
    });
}

// Switch to room
function switchToRoom() {
    window.chatMode = 'room';
    document.querySelector('.chat-messages').innerHTML = '';
    roomMessages.forEach(msg => outputMessage(msg));
    outputRoomName(room);
}

// Click room name to return to room
roomName.addEventListener('click', () => {
    if (window.chatMode !== 'room') {
        switchToRoom();
    }
});

// Leave room
document.getElementById('leave-btn').addEventListener('click', () => {
    const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
    if (leaveRoom) {
        window.location = '../index.html';
    }
});

// Make functions available globally
window.outputMessage = outputMessage;
window.switchToRoom = switchToRoom;