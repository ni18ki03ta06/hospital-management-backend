const router = require('express').Router();
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');
const upload = require('../middleware/upload');
const path = require('path');

// GET /api/messages/:roomId — load chat history
router.get('/:roomId', protect, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/:roomId — send text message (persisted to DB + emitted via socket)
router.post('/:roomId', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }
    const msg = await Message.create({
      roomId:      req.params.roomId,
      senderId:    req.user._id,
      senderName:  req.user.name,
      senderRole:  req.user.role,
      text:        text.trim(),
      messageType: 'TEXT',
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/:roomId/file — send file/image
router.post('/:roomId/file', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    const backendUrl = process.env.BACKEND_URL || `https://hospital-management-backend-production-d851.up.railway.app`;
    const fileUrl = `${backendUrl}/uploads/${req.file.filename}`;

    const msg = await Message.create({
      roomId:      req.params.roomId,
      senderId:    req.user._id,
      senderName:  req.user.name,
      senderRole:  req.user.role,
      fileUrl,
      fileName:    req.file.originalname,
      fileType:    isImage ? 'image' : 'pdf',
      messageType: isImage ? 'IMAGE' : 'FILE',
      text:        '',
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
