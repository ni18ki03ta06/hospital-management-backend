const mongoose = require('mongoose');

const launchPadSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  driveLink: { type: String },
  contact: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('LaunchPad', launchPadSchema);
