const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const cron = require('node-cron');
const path = require('path');

dotenv.config();

// Initialize Firebase Admin SDK early
require('./utils/firebaseAdmin');

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  'https://new-hospital-management-orcin.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // allow all for now
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/chat-token', require('./routes/chatToken'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/revenue', require('./routes/revenue'));
app.use('/api/launchpad', require('./routes/launchpad'));
app.use('/api/social', require('./routes/social'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Socket.io - persist messages to DB
const Message = require('./models/Message');
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => socket.join(roomId));
  socket.on('send-message', async (data) => {
    try {
      // Save to DB
      const msg = await Message.create({
        roomId: data.roomId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        text: data.text,
        messageType: 'TEXT',
      });
      io.to(data.roomId).emit('receive-message', msg);
    } catch {
      io.to(data.roomId).emit('receive-message', data);
    }
  });
  socket.on('disconnect', () => {});
});

// Cron: expire chat tokens every minute
const ChatToken = require('./models/ChatToken');
cron.schedule('* * * * *', async () => {
  const now = new Date();
  await ChatToken.updateMany(
    { status: 'ACTIVE', endTime: { $lte: now } },
    { status: 'EXPIRED' }
  );
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch(err => console.error(err));
