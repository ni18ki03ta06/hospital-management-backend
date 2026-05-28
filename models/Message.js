const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  text: { type: String },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String }, // 'image', 'pdf', 'report'
  messageType: { type: String, enum: ['TEXT', 'FILE', 'IMAGE'], default: 'TEXT' },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
