const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  message: { type: String, default: 'Emergency assistance needed!' },
  status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Emergency', emergencySchema);
