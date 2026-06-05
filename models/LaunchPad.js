const mongoose = require('mongoose');

const STAGES = ['Idea', 'Review', 'Planning', 'Development', 'Launched'];

const launchPadSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  driveLink: { type: String },
  contact: { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stage: {
    type: String,
    enum: STAGES,
    default: 'Idea',
  },
}, { timestamps: true });

module.exports = mongoose.model('LaunchPad', launchPadSchema);
module.exports.STAGES = STAGES;
