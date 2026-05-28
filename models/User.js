const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // firebaseUid links this MongoDB user to their Firebase Auth account
  firebaseUid: { type: String, unique: true, sparse: true },
  // password kept for legacy/internal use (doctor temp passwords, etc.)
  password: { type: String, default: 'temp@1234' },
  role: { type: String, enum: ['MAIN_DOCTOR', 'DOCTOR', 'PATIENT'], required: true },
  mustChangePassword: { type: Boolean, default: false },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
