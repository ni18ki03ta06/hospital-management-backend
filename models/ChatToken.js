const mongoose = require('mongoose');

const chatTokenSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  token: { type: String, required: true, unique: true },
  type: { type: String, enum: ['CHAT', 'VIDEO'], default: 'CHAT' },
  startTime: { type: Date },
  endTime: { type: Date },
  status: { type: String, enum: ['PENDING', 'ACTIVE', 'EXPIRED', 'REJECTED'], default: 'PENDING' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedTo: { type: String, enum: ['ADMIN', 'DOCTOR'], default: 'ADMIN' }
}, { timestamps: true });

module.exports = mongoose.model('ChatToken', chatTokenSchema);
