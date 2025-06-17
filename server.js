import express from 'express';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: '*',
  },
});

// Serve static files from frontend/dist
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// ---- Chat Namespace ----
const chatNameSpace = io.of('/chat');

chatNameSpace.on('connection', (socket) => {
  socket.userData = { name: '' };
  console.log(`${socket.id} connected to /chat`);

  socket.on('setName', (name) => {
    socket.userData.name = name;
  });

  socket.on('send-message', (message, time) => {
    socket.broadcast.emit('recieved-message', socket.userData.name, message, time);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected from /chat`);
  });
});

// ---- Update Namespace ----
const updateNameSpace = io.of('/update');
const connectedSockets = new Map();

updateNameSpace.on('connection', (socket) => {
  socket.userData = {
    position: { x: 0, y: -500, z: -500 },
    quaternion: { x: 0, y: 0, z: 0, w: 0 },
    animation: 'idle',
    name: '',
    avatarSkin: '',
  };

  connectedSockets.set(socket.id, socket);
  console.log(`${socket.id} connected to /update`);

  socket.on('setID', () => {
    updateNameSpace.emit('setID', socket.id);
  });

  socket.on('setName', (name) => {
    socket.userData.name = name;
  });

  socket.on('setAvatar', (avatarSkin) => {
    updateNameSpace.emit('setAvatarSkin', avatarSkin, socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`);
    connectedSockets.delete(socket.id);
    updateNameSpace.emit('removePlayer', socket.id);
  });

  socket.on('initPlayer', (player) => {
    // future initialization logic
  });

  socket.on('updatePlayer', (player) => {
    const u = socket.userData;
    u.position = player.position;
    u.quaternion = {
      x: player.quaternion[0],
      y: player.quaternion[1],
      z: player.quaternion[2],
      w: player.quaternion[3],
    };
    u.animation = player.animation;
    u.avatarSkin = player.avatarSkin;
  });

  setInterval(() => {
    if (
      socket.userData.name === '' ||
      socket.userData.avatarSkin === ''
    ) return;

    const playerData = [];

    for (const s of connectedSockets.values()) {
      const u = s.userData;
      if (u.name && u.avatarSkin) {
        playerData.push({
          id: s.id,
          name: u.name,
          position_x: u.position.x,
          position_y: u.position.y,
          position_z: u.position.z,
          quaternion_x: u.quaternion.x,
          quaternion_y: u.quaternion.y,
          quaternion_z: u.quaternion.z,
          quaternion_w: u.quaternion.w,
          animation: u.animation,
          avatarSkin: u.avatarSkin,
        });
      }
    }

    updateNameSpace.emit('playerData', playerData);
  }, 20);
});

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
