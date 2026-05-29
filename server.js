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

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins (mobile app, web, Postman)
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/doctors',    require('./routes/doctors'));
app.use('/api/patients',   require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/referrals',  require('./routes/referrals'));
app.use('/api/chat-token', require('./routes/chatToken'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/revenue',    require('./routes/revenue'));
app.use('/api/launchpad',  require('./routes/launchpad'));
app.use('/api/social',     require('./routes/social'));
app.use('/api/messages',   require('./routes/messages'));
app.use('/api/emergency',  require('./routes/emergency'));
app.use('/api/chatbot',    require('./routes/chatbot'));

// ── Socket.io chat ────────────────────────────────────────────────────────────
// Room ID convention: chat_{smallerUserId}_{largerUserId}  (sorted so both sides match)
const Message = require('./models/Message');

io.on('connection', (socket) => {
  // Client sends: { roomId }
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  // Client sends: { roomId, senderId, senderName, senderRole, text, fileUrl, fileName, fileType }
  socket.on('send-message', async (data) => {
    try {
      const msg = await Message.create({
        roomId:      data.roomId,
        senderId:    data.senderId,
        senderName:  data.senderName,
        senderRole:  data.senderRole,
        text:        data.text || '',
        fileUrl:     data.fileUrl  || null,
        fileName:    data.fileName || null,
        fileType:    data.fileType || null,
        messageType: data.fileUrl ? (data.fileType === 'image' ? 'IMAGE' : 'FILE') : 'TEXT',
      });
      // Emit to everyone in the room (including sender for confirmation)
      io.to(data.roomId).emit('receive-message', msg);
    } catch (err) {
      // Fallback: emit without DB persistence
      socket.to(data.roomId).emit('receive-message', {
        ...data,
        _id: Date.now().toString(),
        createdAt: new Date(),
      });
    }
  });

  socket.on('disconnect', () => {});
});

// ── Cron: expire chat tokens every minute ─────────────────────────────────────
const ChatToken = require('./models/ChatToken');
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    await ChatToken.updateMany(
      { status: 'ACTIVE', endTime: { $lte: now } },
      { $set: { status: 'EXPIRED' } }
    );
  } catch (err) {
    console.error('Cron error:', err.message);
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;
    server.listen(port, () => })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
