// groupManager.js - Handles all group chat functionality

class GroupManager {
    constructor(socket,user) {
        this.socket = socket;
        this.currentGroupId = null ;
        this.myGroups = [];
        this.allGroups = [];
        this.loadGroups();
        if (!this.groupMessages) {
            this.groupMessages = new Map();
        }
        this.user = user  || { id: socket.id, username: 'Unknown', group: null };
        // Only initialize listeners if DOM elements exist
        if (document.getElementById('create-group-btn')) {
            this.initializeEventListeners();
        }
        this.initializeSocketListeners();
    }
    setUser(user) {
        this.user = user || this.user;
    }
    // ========== SOCKET LISTENERS ==========
    
    initializeSocketListeners() {
        // Group created
        this.socket.on('groupCreated', (group) => {
            this.myGroups.push(group);
            this.currentGroupId = group.id;
            this.allGroups.push(group);

            const welcomeMessage = {
                username: 'PinguHR', // Or whatever your botName is
                text: `Welcome to ${group.name}! You are the creator.`,
                time: new Date().toLocaleTimeString() // Or however you format time
            };

            if (!this.groupMessages.has(group.id)) {
                this.groupMessages.set(group.id, []);
            }
            this.groupMessages.get(group.id).push(welcomeMessage);

            this.saveGroups();
            
            this.updateMyGroupsList();
            this.switchToGroup(group.id);
            window.showNotification(`Group "${group.name}" created!`, 'success');
        });

        // All groups list
        this.socket.on('allGroupsList', (groups) => {
            this.allGroups = groups;
            this.myGroups = groups.filter(g => 
                g.members.some(m => m.id === this.socket.id)
            );
            
            this.updateMyGroupsList();
            this.updateAllGroupsList();
        });

        // Group list updated
        this.socket.on('groupListUpdated', (groups) => {
            this.allGroups = groups;
            this.myGroups = groups.filter(g => 
                g.members.some(m => m.id === this.socket.id)
            );
            
            this.updateMyGroupsList();
            this.updateAllGroupsList();
        });

        // Group joined
        this.socket.on('groupJoined', (group) => {
            if (!this.myGroups.find(g => g.id === group.id)) {
                this.myGroups.push(group);
            }
            
            if (!this.groupMessages.has(group.id)) {
                this.groupMessages.set(group.id, []);
            }

            this.user.group = group.name;
            this.socket.emit('userGroupUpdated', { userId: this.user.id, groupName: this.user.group });

            
            this.updateMyGroupsList();
            this.switchToGroup(group.id);
            window.showNotification(`Joined "${group.name}"`, 'success');
        });

        // Group message
        this.socket.on('groupMessage', ({ groupId, message }) => {
            if (!this.groupMessages.has(groupId)) {
                this.groupMessages.set(groupId, []);
            }
            
            this.groupMessages.get(groupId).push(message);

            this.saveGroups();
            
            if (this.currentGroupId === groupId && window.chatMode === 'group') {
                window.outputMessage(message);
            } else {
                this.showGroupNotification(groupId);
            }
        });

        // Group left
        this.socket.on('groupLeft', ({ groupId }) => {
            this.myGroups = this.myGroups.filter(g => g.id !== groupId);
            this.groupMessages.delete(groupId);
            
            if (this.currentGroupId === groupId) {
                window.switchToRoom();
            }
            
            this.updateMyGroupsList();
            window.showNotification('Left the group', 'info');
        });

        // Group deleted
        this.socket.on('groupDeleted', ({ groupId }) => {
            this.myGroups = this.myGroups.filter(g => g.id !== groupId);
            this.allGroups = this.allGroups.filter(g => g.id !== groupId);
            this.groupMessages.delete(groupId);
            
            if (this.currentGroupId === groupId) {
                window.switchToRoom();
                window.showNotification('Group deleted by creator', 'warning');
            }
            
            this.updateMyGroupsList();
            this.updateAllGroupsList();
        });

        // Group invitation
        this.socket.on('groupInvitation', ({ group, inviter }) => {
            if (confirm(`${inviter.username} invited you to "${group.name}". Join?`)) {
                this.socket.emit('joinGroup', { groupId: group.id });
            }
        });
    }

    // ========== UI EVENT LISTENERS ==========
    
    initializeEventListeners() {
        // Create group button
        document.getElementById('create-group-btn').addEventListener('click', () => {
            document.getElementById('create-group-modal').style.display = 'block';
            document.getElementById('group-name-input').focus();
        });

        // Create group form
        document.getElementById('create-group-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const groupName = document.getElementById('group-name-input').value.trim();
            
            if (groupName) {
                this.socket.emit('createGroup', { groupName });
                document.getElementById('create-group-modal').style.display = 'none';
                document.getElementById('group-name-input').value = '';
            }
        });

        // Refresh groups
        document.getElementById('refresh-groups-btn').addEventListener('click', () => {
            this.socket.emit('getAllGroups');
            window.showNotification('Groups refreshed', 'info');
        });
    }

    // ========== UI UPDATE METHODS ==========
    
    updateMyGroupsList() {
        const list = document.getElementById('my-groups');
        list.innerHTML = '';
        
        if (this.myGroups.length === 0) {
            list.innerHTML = '<li class="no-groups-message" style="color: #99aab5; padding: 10px; text-align: center;">No groups</li>';
            return;
        }
        
        this.myGroups.forEach(group => {
            const li = document.createElement('li');
            li.dataset.groupId = group.id;
            
            if (this.currentGroupId === group.id && window.chatMode === 'group') {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
            
            const isCreator = group.creator.id === this.socket.id;
            
            li.innerHTML = `
                <div class="group-item-header">
                    <span class="group-item-name">
                        ${group.name}
                    </span>
                </div>
                <div class="group-item-members">
                    <i class="fas fa-users"></i> ${group.members.length} member${group.members.length > 1 ? 's' : ''}
                </div>
            `;
            
            li.addEventListener('click', () => this.switchToGroup(group.id));
            list.appendChild(li);
        });
    }

    updateAllGroupsList() {
        const list = document.getElementById('all-groups');
        list.innerHTML = '';
        
        if (this.allGroups.length === 0) {
            list.innerHTML = '<li class="no-groups-message" style="color: #99aab5; padding: 10px; text-align: center;">No groups</li>';
            return;
        }
        
        this.allGroups.forEach(group => {
            const li = document.createElement('li');
            const isMember = group.members.some(m => m.id === this.socket.id);
            
            li.innerHTML = `
                <div class="group-item-header">
                    <span class="group-item-name">
                        ${group.name}
                    </span>
                </div>
                <div class="group-item-members">
                    <i class="fas fa-user"></i> ${group.creator.username} • 
                    <i class="fas fa-users"></i> ${group.members.length}
                </div>
            `;
            
            li.addEventListener('click', () => this.showGroupDetails(group));
            list.appendChild(li);
        });
    }

    showGroupDetails(group) {
        const modal = document.getElementById('group-details-modal');
        const isMember = group.members.some(m => m.id === this.socket.id);
        const isCreator = group.creator.id === this.socket.id;
        
        document.getElementById('group-details-name').textContent = group.name;
        document.getElementById('group-details-creator').textContent = group.creator.username;
        document.getElementById('group-details-member-count').textContent = group.members.length;
        
        const membersList = document.getElementById('group-details-members');
        membersList.innerHTML = '';
        group.members.forEach(member => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${member.username} ${member.id === group.creator.id ? '👑' : ''}</span>`;
            membersList.appendChild(li);
        });
        
        const actions = document.getElementById('group-actions');
        actions.innerHTML = '';
        
        if (!isMember) {
            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-success';
            joinBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join';
            joinBtn.onclick = () => {
                this.socket.emit('joinGroup', { groupId: group.id });
                modal.style.display = 'none';
            };
            actions.appendChild(joinBtn);
        } else {
            const openBtn = document.createElement('button');
            openBtn.className = 'btn';
            openBtn.innerHTML = '<i class="fas fa-comments"></i> Open';
            openBtn.onclick = () => {
                this.switchToGroup(group.id);
                modal.style.display = 'none';
            };
            actions.appendChild(openBtn);
            
            if (!isCreator) {
                const leaveBtn = document.createElement('button');
                leaveBtn.className = 'btn btn-danger';
                leaveBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Leave';
                leaveBtn.onclick = () => {
                    if (confirm(`Leave "${group.name}"?`)) {
                        this.socket.emit('leaveGroup', { groupId: group.id });
                        modal.style.display = 'none';
                    }
                };
                actions.appendChild(leaveBtn);
            } else {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                deleteBtn.onclick = () => {
                    if (confirm(`Delete "${group.name}"?`)) {
                        this.socket.emit('deleteGroup', { groupId: group.id });
                        modal.style.display = 'none';
                    }
                };
                actions.appendChild(deleteBtn);
            }
        }
        
        modal.style.display = 'block';
    }

    showGroupNotification(groupId) {
        const li = document.querySelector(`#my-groups li[data-group-id="${groupId}"]`);
        if (li && !li.classList.contains('active')) {
            if (!li.querySelector('.notification-badge')) {
                const badge = document.createElement('span');
                badge.className = 'group-badge notification-badge';
                badge.textContent = '!';
                badge.style.background = '#f04747';
                li.querySelector('.group-item-header').appendChild(badge);
            }
        }
    }

    // ========== CHAT SWITCHING ==========
    
    switchToGroup(groupId) {
        const group = this.allGroups.find(g => g.id === groupId);
        if (!group) return;
        
        this.currentGroupId = groupId;
        window.chatMode = 'group';
        
        this.socket.emit('userGroupUpdated', { userId: this.user.id, groupName: this.user.group });

        this.user.group = group.name
        document.querySelector('.chat-messages').innerHTML = '';

        
        const messages = this.groupMessages.get(groupId) || [];
        messages.forEach(msg => window.outputMessage(msg));
        
        // const roomNameEl = document.getElementById('room-name');
        // roomNameEl.innerHTML = `${group.name} <span class="chat-mode-indicator mode-group">GROUP</span>`;
        
                // Clear active state from DMs when switching to group
        if (window.dmManager) {
            window.dmManager.currentDmRoom = null;
            window.dmManager.updateDmList();
        }
        
        
        this.updateMyGroupsList();

        this.socket.emit('updateUserChatContext', { type: 'group', name: group.name });
    }

    sendMessage(message) {
        if (this.currentGroupId) {
            this.socket.emit('groupMessage', { 
                groupId: this.currentGroupId, 
                message 
            });
        }
    }

    initialize() {
        this.socket.emit('getAllGroups');
    }

    saveGroups() {
        const groupObject = Object.fromEntries(this.groupMessages);
        localStorage.setItem('groupMessages', JSON.stringify(groupObject));
    }

    loadGroups() {
        const savedGroups = localStorage.getItem('groupMessages');
        if (savedGroups) {
            const groupObject = JSON.parse(savedGroups);
            this.groupMessages = new Map(Object.entries(groupObject));
        }
    }
}

// Export for use in main.js
window.GroupManager = GroupManager;