const router = require('express').Router();
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/messages/:roomId - get chat history
router.get('/:roomId', protect, async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .sort({ createdAt: 1 })
      .limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:roomId - send text message (saved to DB)
router.post('/:roomId', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const msg = await Message.create({
      roomId: req.params.roomId,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      text,
      messageType: 'TEXT',
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:roomId/file - send file/image
router.post('/:roomId/file', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    const fileUrl = `${process.env.BACKEND_URL || ''}/uploads/${req.file.filename}`;
    const msg = await Message.create({
      roomId: req.params.roomId,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      fileUrl,
      fileName: req.file.originalname,
      fileType: isImage ? 'image' : 'pdf',
      messageType: isImage ? 'IMAGE' : 'FILE',
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
