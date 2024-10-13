const express = require("express");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());

// Enable CORS for Express server
app.use(
  cors({
    origin: "http://localhost:3000", // Allow requests from the React app
    credentials: true, // Allow credentials (e.g., cookies)
  })
);

// Start Express server
app.listen(8000, () => console.log("Listening on PORT 8000"));

// Set up Socket.io with CORS
const io = new Server(8001, {
  cors: {
    origin: "http://localhost:3000", // Allow requests from the React app
    methods: ["GET", "POST"],
    credentials: true, // Allow credentials (e.g., cookies)
  },
});

const emailToSocketMapping = new Map();
const socketToEmailMapping = new Map();

io.on("connection", (socket) => {
  console.log("New connection established:", socket.id);

  socket.on("join-room", (data) => {
    const { emailId, roomId } = data;

    const clientsInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    // console.log("Room is full. You cannot join.");
    if (clientsInRoom >= 2) {
      socket.emit("room-full", { message: "Room is full. You cannot join." });
    } else {
      socket.join(roomId);
      console.log("User", emailId, "joined room", roomId);
      emailToSocketMapping.set(emailId, socket.id);
      socketToEmailMapping.set(socket.id, emailId);
      socket.emit("joined-room", { roomId });
      // Notify other users in the room
      socket.broadcast.to(roomId).emit("user-joined", { emailId });
    }
  });

  socket.on("call-user", (data) => {
    const { emailId, offer } = data;
    console.log("Email and offer: ", emailId, offer);
    const from = socketToEmailMapping.get(socket.id);
    const socketId = emailToSocketMapping.get(data.emailId, { from, offer });

    socket.to(socketId).emit("incoming-call", { from, offer });
  });

  socket.on("call-accepted", (data) => {
    const { answer, from } = data;
    const socketId = emailToSocketMapping.get(from);
    socket.to(socketId).emit("call-accepted", { answer });
  });

  socket.on("video-toggle", ({ isVideoEnabled, emailId }) => {
    const socketId = emailToSocketMapping.get(emailId);
    socket.to(socketId).emit("video-updated", { isVideoEnabled });
  });

  socket.on("video-status", ({ isVideoOn, emailId }) => {
    const socketId = emailToSocketMapping.get(emailId);
    socket.to(socketId).emit("video-status-update", { isVideoOn });
  });

  socket.on("disconnect", () => {
    console.log(
      `User with email: ${socketToEmailMapping.get(socket.id)} disconnected`
    );
  });
});

console.log("Socket.io server listening on port 8001");
