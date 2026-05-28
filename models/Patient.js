const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  age: { type: Number },
  diagnosis: { type: String, default: '' }, // primary diagnosis / condition
  medicalHistory: { type: String, default: '' },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // doctor who added
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },

  // Active means the patient is currently under THIS doctor's care
  // When referred to admin (Dr. Ravikant Patil), isActive becomes false at doctor side
  // and the patient is considered active at admin side
  isActive: { type: Boolean, default: true },

  // Track if patient is currently referred to admin (Dr. Ravikant Patil)
  referredToAdmin: { type: Boolean, default: false },

  prescriptions: [{
    title: String,
    description: String,
    medicines: [{
      name: String,
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: false },
      night: { type: Boolean, default: false },
      beforeMeal: { type: Boolean, default: false },
      afterMeal: { type: Boolean, default: false },
    }],
    endDate: { type: Date },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);
