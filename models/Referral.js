const mongoose = require('mongoose');

// Cardiac conditions for referral to Dr. Ravikant Patil
const CARDIAC_CONDITIONS = [
  'Coronary Artery Disease (CAD)',
  'Heart Failure',
  'Arrhythmia / Atrial Fibrillation',
  'Valvular Heart Disease',
  'Hypertensive Heart Disease',
  'Cardiomyopathy',
  'Pericarditis / Myocarditis',
  'Congenital Heart Disease',
  'Peripheral Artery Disease',
  'Post-Cardiac Surgery Follow-up',
  'Chest Pain / Angina',
  'Other Cardiac Condition',
];

const referralSchema = new mongoose.Schema({
  // patientId is now optional — for email-only referrals it may be null initially
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patientEmail: { type: String, default: '' },
  fromDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null when toAdmin=true
  toAdmin: { type: Boolean, default: false },
  cardiacCondition: { type: String, enum: [...CARDIAC_CONDITIONS, ''], default: '' },
  reason: { type: String, default: '' },
  photoUrl: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'DISCHARGED'], default: 'PENDING' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dischargedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);
module.exports.CARDIAC_CONDITIONS = CARDIAC_CONDITIONS;
