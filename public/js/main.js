const chatForm = document.getElementById('chat-form')
const chatMessage = document.querySelector('.chat-messages')
const roomName = document.getElementById('room-name')
const userList = document.getElementById('users')
const leaveBtn = document.getElementById('leave-btn');


//get username and room from URL
const {username,room} = Qs.parse(location.search,{
  ignoreQueryPrefix: true
})


const socket = io();

//Join chatRoom
socket.emit('joinRoom', {username, room})

// This listens for the error event from the server
socket.on('joinError', (error) => {
    alert(error); // Show the error in a popup
    window.location.href = '/'; // Redirect back to the login page
});

//get room and users 
socket.on('roomUsers', ({room,users})=>{
  outputRoomName(room)
  outputUsers(users)
})


//Message from server 
socket.on('message', message =>{
  console.log(message);
  outputMessage(message);

  //scroll down automatically
  chatMessage.scrollTop = chatMessage.scrollHeight
})

//Message submit 
chatForm.addEventListener('submit',  e =>{
  e.preventDefault(); // default => submit goes to file => we want to stop that 

  //Get message text (look for .??? from chat.html)
  const msg =e.target.elements.msg.value

  //Emit message to the server
  socket.emit('chatMessage' ,msg)

  //clear  input

  e.target.elements.msg.value = ''
  e.target.elements.msg.focus() 
})

//user click leave room
leaveBtn.addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chat room?');
  if (leaveRoom) {
    window.location = '/';
  }
});

//output message to DOM
function outputMessage(message){
  const div = document.createElement('div')
  div.classList.add('message')
  div.innerHTML = `
  <p class="'meta">${message.username} <span>${message.time}</span></p>
  <p class="text">
    ${message.text}
  </p>
  `

  document.querySelector('.chat-messages').appendChild(div)

}

//add room name to DOM
function outputRoomName(room){
  roomName.innerText=room
}

function outputUsers(users){
  userList.innerHTML = 
  `${users.map(user=> `<li>${user.username}</li>`).join('')}`
}