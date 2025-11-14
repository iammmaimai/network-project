const users =[]

//join user to chat 
function userJoin(id,username,room){
    const existingUser = users.find(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );

    // If user exists, return an error
    if (existingUser) {
        return { error: 'Username is already taken in this room.' };
    }
    const user = {id,username,room, group: null}

    users.push(user)

    return {user}
}

//get current user 
function getCurrentUser(id){
    return users.find(user => user.id === id)
}

//user leave chat 
function userLeave(id){
    const index = users.findIndex(user => user.id === id)
    if (index!== -1){
        return users.splice(index,1)[0]
    }
}

function getRoomUsers(room){
    return users.filter(user => user.room === room)
}

function getAllUsers(){
    return users.map(u => ({
        id: u.id,
        username: u.username,
        room: u.room,
        group: u.group 
    }));
}
module.exports ={
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
    getAllUsers
}