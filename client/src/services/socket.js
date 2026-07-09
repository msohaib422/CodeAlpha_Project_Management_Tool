import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

let socket = null;

export const initiateSocketConnection = (userId) => {
  if (socket) {
    if (userId) {
      socket.emit('join', userId);
      console.log(`Socket re-joined room: ${userId}`);
    }
    return socket;
  }

  socket = io(SOCKET_URL);
  console.log('Connecting socket...');
  
  socket.on('connect', () => {
    console.log('Socket connected to server');
    if (userId) {
      socket.emit('join', userId);
      console.log(`Socket joined room: ${userId}`);
    }
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

