// dmManager.js - Handles all direct messaging functionality

class DMManager {
    constructor(socket) {
        this.socket = socket;
        this.currentDmRoom = null;

        this.loadDMs();

        if(!this.dmConversations) 
            this.dmConversations = new Map();
        
        this.initializeEventListeners();
        this.initializeSocketListeners();

        this.updateDmList();
    }

    // ========== SOCKET LISTENERS ==========
    
    initializeSocketListeners() {
        // All users list
        this.socket.on('allUsersList', users => {
            const list = document.getElementById('available-users');
            list.innerHTML = '';
            
            users.forEach(user => {
                const li = document.createElement('li');
                li.textContent = `${user.username} (${user.room})`;
                li.addEventListener('click', () => {
                    this.socket.emit('requestPrivateChat', { targetUsername: user.username });
                    document.getElementById('dm-modal').style.display = 'none';
                });
                list.appendChild(li);
            });
        });

        // Private chat ready
        this.socket.on('privateChatReady', ({ dmRoomId, otherUser }) => {
            if (!this.dmConversations.has(dmRoomId)) {
                this.dmConversations.set(dmRoomId, {
                    otherUser,
                    messages: []
                });
                this.updateDmList();
            } else {
                this.dmConversations.get(dmRoomId).otherUser = otherUser;
            }
            this.saveDMs();
            this.updateDmList();
            this.switchToDm(dmRoomId);
        });

        // Private message received
        this.socket.on('privateMessageReceived', ({ dmRoomId, message }) => {
            if (!this.dmConversations.has(dmRoomId)) {
                this.dmConversations.set(dmRoomId, { messages: [] });
            }
            
            const dmData = this.dmConversations.get(dmRoomId);
            dmData.messages.push(message);

            this.saveDMs();
            
            if (this.currentDmRoom === dmRoomId && window.chatMode === 'dm') {
                window.outputMessage(message);
            }
            
            this.updateDmList();
        });
    }

    // ========== UI EVENT LISTENERS ==========
    
    initializeEventListeners() {
        document.getElementById('show-dm-users').addEventListener('click', () => {
            this.socket.emit('getAllUsers');
            document.getElementById('dm-modal').style.display = 'block';
        });
    }

    // ========== UI UPDATES ==========
    
    updateDmList() {
        const list = document.getElementById('dm-conversations');
        list.innerHTML = '';
        
        if (this.dmConversations.size === 0) {
            list.innerHTML = '<li style="color: #99aab5; padding: 10px; text-align: center;">No DMs</li>';
            return;
        }
        
        this.dmConversations.forEach((data, dmRoomId) => {
            const li = document.createElement('li');
            li.textContent = data.otherUser.username;
            // Only add active class if we're in DM mode AND this is the current DM
            if (this.currentDmRoom === dmRoomId && window.chatMode === 'dm') {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
            li.addEventListener('click', () => this.switchToDm(dmRoomId));
            list.appendChild(li);
        });
    }

    switchToDm(dmRoomId) {
        this.currentDmRoom = dmRoomId;
        window.chatMode = 'dm';
        const dmData = this.dmConversations.get(dmRoomId);
        
        document.querySelector('.chat-messages').innerHTML = '';
        dmData.messages.forEach(msg => window.outputMessage(msg));
        
        const roomNameEl = document.getElementById('room-name');
        roomNameEl.innerHTML = `DM: ${dmData.otherUser.username} <span class="chat-mode-indicator mode-dm">DM</span>`;
        
        if (window.groupManager) {
            window.groupManager.currentGroupId = null;
            window.groupManager.updateMyGroupsList();
        }

        this.updateDmList();

        this.socket.emit('updateUserChatContext', { type: 'dm', name: '' });
    }

    sendMessage(message) {
        if (this.currentDmRoom) {
            this.socket.emit('privateMessage', { 
                dmRoomId: this.currentDmRoom, 
                message 
            });
        }
    }

    saveDMs() {
        const dmObject = Object.fromEntries(this.dmConversations);
        localStorage.setItem('dmConversations', JSON.stringify(dmObject));
    }

    loadDMs() {
        const savedDMS = localStorage.getItem('dmConversations');
        if (savedDMS) {
            const dmObject = JSON.parse(savedDMS);
            this.dmConversations = new Map(Object.entries(dmObject));
        }
    }
}

window.DMManager = DMManager;