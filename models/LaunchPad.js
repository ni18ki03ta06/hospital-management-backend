const mongoose = require('mongoose');

const STAGES = [
  'SUBMITTED',
  'IDEA_VALIDATION',
  'MVP_EARLY_TRACTION',
  'PITCH_PREPARATION',
  'INVESTOR_OUTREACH',
  'SEED_FUNDING_CLOSURE',
];

const launchPadSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  driveLink:   { type: String },
  contact:     { type: String },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  stage: {
    type:    String,
    enum:    STAGES,
    default: 'SUBMITTED',
  },
  stageNote:      { type: String, default: '' },
  stageUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('LaunchPad', launchPadSchema);
module.exports.STAGES = STAGES;
