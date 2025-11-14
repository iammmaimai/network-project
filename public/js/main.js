const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const totalUsersCount = document.getElementById('total-users-count');
const totalUsersList = document.getElementById('total-users-list');
//Add emoji
const msgInput = document.getElementById('msg');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
// Image upload
const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
let selectedImage = null;

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

// Listen for server stats (total users online)
socket.on('serverStats', ({ totalUsers, allUsers }) => {
    console.log(allUsers)
    outputServerStats(totalUsers, allUsers);
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

        window.groupManager = groupManager;
        window.dmManager = dmManager;
        
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

// Image upload handler
if (imageBtn && imageInput) {
    imageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB');
                imageInput.value = '';
                return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImage = {
                    data: event.target.result,
                    type: file.type,
                    name: file.name
                };
                // Show preview or indicator
                imageBtn.style.background = 'var(--success-color)';
                imageBtn.title = 'Image selected - Click to change';
            };
            reader.readAsDataURL(file);
        }
    });
}

//Emoji picker
// ---------- Emoji button + picker logic ----------
if (emojiBtn && emojiPicker && msgInput) {
    // Toggle picker show/hide
    emojiBtn.addEventListener('click', () => {
        emojiPicker.classList.toggle('hidden');
    });

    // Click on emoji → append to input
    emojiPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji-item')) {
            const emoji = e.target.textContent;
            msgInput.value += emoji;
            msgInput.focus();
        }
    });

    // Optional: click outside to close picker
    document.addEventListener('click', (e) => {
        const clickedInside =
            emojiPicker.contains(e.target) || emojiBtn.contains(e.target);
        if (!clickedInside) {
            emojiPicker.classList.add('hidden');
        }
    });
}



// Message submit
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = e.target.elements.msg.value.trim();
    const hasImage = selectedImage !== null;
    
    // Must have either text or image
    if (!msg && !hasImage) return;
    
    // Prepare message data
    const messageData = {
        text: msg || '',
        image: hasImage ? selectedImage : null
    };
    
    // Route message based on mode
    if (window.chatMode === 'group') {
        groupManager.sendMessage(messageData);
    } else if (window.chatMode === 'dm') {
        dmManager.sendMessage(messageData);
    } else {
        socket.emit('chatMessage', messageData);
    }
    
    // Reset form
    e.target.elements.msg.value = '';
    selectedImage = null;
    imageInput.value = '';
    imageBtn.style.background = '';
    imageBtn.title = 'Upload Image';
    e.target.elements.msg.focus();
});
//SpeakText Jaaa; Pik
function speakText(text, lang = 'en-US') {
    if (!('speechSynthesis' in window)) {
        alert('Sorry, your browser does not support text to speech.');
        return;
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;  // 'en-US' or 'th-TH'
    window.speechSynthesis.speak(utterance);
}

// Output message to DOM ; modified by Pik in case u wanna ask or change anything ja
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');

    const messageTime = new Date(message.time);

    const formattedTime = messageTime.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit' 
    });

    // Username + time
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    p.innerHTML += `<span> ${formattedTime}</span>`;
    div.appendChild(p);

    // --- Create wrapper for message content ---
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '8px';

    // The image (if exists) - goes on its own row
    if (message.image) {
        const imgContainer = document.createElement('div');
        imgContainer.classList.add('message-image-container');
        
        const img = document.createElement('img');
        img.src = message.image.data;
        img.alt = message.image.name || 'Image';
        img.classList.add('message-image');
        img.style.maxWidth = '300px';
        img.style.maxHeight = '300px';
        img.style.borderRadius = '8px';
        img.style.cursor = 'pointer';
        
        // Click to view full size
        img.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '10000';
            modal.style.cursor = 'pointer';
            
            const fullImg = document.createElement('img');
            fullImg.src = message.image.data;
            fullImg.style.maxWidth = '90%';
            fullImg.style.maxHeight = '90%';
            fullImg.style.objectFit = 'contain';
            
            modal.appendChild(fullImg);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        });
        
        imgContainer.appendChild(img);
        wrapper.appendChild(imgContainer);
    }

    // Text and TTS button row (only if there's text)
    if (message.text) {
        const textRow = document.createElement('div');
        textRow.style.display = 'flex';
        textRow.style.alignItems = 'center';
        textRow.style.gap = '8px';

        // The message text
        const para = document.createElement('p');
        para.classList.add('text');
        para.innerText = message.text;
        textRow.appendChild(para);

        // The TTS button 🔊
        const ttsBtn = document.createElement('button');
        ttsBtn.classList.add('tts-btn');
        ttsBtn.innerText = "🔊";
        ttsBtn.style.border = "none";
        ttsBtn.style.background = "transparent";
        ttsBtn.style.cursor = "pointer";
        ttsBtn.style.fontSize = "18px";

        // When clicked → speak the message
        ttsBtn.addEventListener('click', () => {
            speakText(message.text, 'en-US');   // change to 'th-TH' if you prefer Thai voice
        });

        textRow.appendChild(ttsBtn);
        wrapper.appendChild(textRow);
    }

    // Add wrapper into message div
    div.appendChild(wrapper);

    // Append final message block
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Add room name to DOM
function outputRoomName(room) {
    roomName.innerHTML = `${room} <span class="chat-mode-indicator mode-room">ROOM</span>`;
}

// Add users to DOM (users in current room)
function outputUsers(users) {
    userList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.innerText = user.username;
        li.dataset.id = user.id;
        userList.appendChild(li);
    });
}

// Add server stats to DOM (total users online)
function outputServerStats(totalUsers, allUsers) {
    // Update the count
    if (totalUsersCount) {
        totalUsersCount.innerText = totalUsers;
    }
    
    // Update the list
    if (totalUsersList) {
        totalUsersList.innerHTML = '';
        allUsers.forEach((user) => {
            const li = document.createElement('li');
            console.log(user.room)
            console.log(user.group)
            li.innerHTML = `
                <div>
                    <span class="user-name">${user.username}</span>
                    <span class="user-room">${user.group ? "Chat: " + user.group : "Chat: " + user.room}</span>
                </div>
            `;
            li.dataset.id = user.id;
            totalUsersList.appendChild(li);
        });
    }
}

// Switch to room
function switchToRoom() {
    window.chatMode = 'room';
    document.querySelector('.chat-messages').innerHTML = '';
    roomMessages.forEach(msg => outputMessage(msg));
    outputRoomName(room);

    if (window.groupManager) {
        window.groupManager.currentGroupId = null;
        window.groupManager.updateMyGroupsList();
    }
    if (window.dmManager) {
        window.dmManager.currentDmRoom = null;
        window.dmManager.updateDmList();
    }
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

socket.on('updateUserGroup', ({ userId, groupName }) => {
    const userLi = document.querySelector(`#total-users-list li[data-id="${userId}"]`);
    if (userLi) {
        const roomSpan = userLi.querySelector('.user-room');
        if (roomSpan) {
            roomSpan.textContent = `Chat: ${groupName || 'Room'}`;
        }
    }
});

// Make functions available globally
window.outputMessage = outputMessage;
window.switchToRoom = switchToRoom;