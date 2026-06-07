const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  message: { type: String, default: 'Emergency assistance needed!' },
  status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  location: {
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy:  { type: Number, default: null },
    address:   { type: String, default: '' },
    mapsLink:  { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Emergency', emergencySchema);
