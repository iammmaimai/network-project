const groups = [];

// Create a new group
function createGroup(groupName, creatorId, creatorUsername) {
    const group = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: groupName,
        creator: { id: creatorId, username: creatorUsername },
        members: [{ id: creatorId, username: creatorUsername }],
        createdAt: new Date()
    };
    groups.push(group);
    return group;
}

// Get all groups
function getAllGroups() {
    return groups;
}

// Get a specific group
function getGroup(groupId) {
    return groups.find(g => g.id === groupId);
}

// Add member to group
function addMemberToGroup(groupId, userId, username) {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        // Check if user is already a member
        const isMember = group.members.some(m => m.id === userId);
        if (!isMember) {
            group.members.push({ id: userId, username });
            return true;
        }
    }
    return false;
}

// Remove member from group
function removeMemberFromGroup(groupId, userId) {
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const index = group.members.findIndex(m => m.id === userId);
        if (index !== -1) {
            group.members.splice(index, 1);
            return true;
        }
    }
    return false;
}

// Check if user is member of group
function isMemberOfGroup(groupId, userId) {
    const group = groups.find(g => g.id === groupId);
    return group ? group.members.some(m => m.id === userId) : false;
}

// Delete group (only by creator)
function deleteGroup(groupId, userId) {
    const index = groups.findIndex(g => g.id === groupId && g.creator.id === userId);
    if (index !== -1) {
        groups.splice(index, 1);
        return true;
    }
    return false;
}

// Get groups where user is a member
function getUserGroups(userId) {
    return groups.filter(g => g.members.some(m => m.id === userId));
}

module.exports = {
    createGroup,
    getAllGroups,
    getGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    isMemberOfGroup,
    deleteGroup,
    getUserGroups
};