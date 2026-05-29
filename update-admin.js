/**
 * One-time script to update admin credentials on production MongoDB.
 * 
 * Usage:
 *   MONGO_URI="mongodb+srv://..." node update-admin.js
 * 
 * Or set MONGO_URI in .env and run:
 *   node update-admin.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set. Add it to .env or pass as environment variable.');
  process.exit(1);
}

// Inline User model (no dependency on other files)
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  resetToken: String,
  resetTokenExpiry: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function updateAdmin() {
  await mongoose.connect(MONGO_URI);
  const admin = await User.findOne({ role: 'MAIN_DOCTOR' });

  if (!admin) {
    // Create fresh admin
    await User.create({
      name: 'Dr. Ravikant Patil',
      email: 'shrikantmhaske05@gmail.com',
      password: 'admin',
      role: 'MAIN_DOCTOR',
    });
    } else {
    // Update existing admin
    admin.name = 'Dr. Ravikant Patil';
    admin.email = 'shrikantmhaske05@gmail.com';
    admin.password = 'admin';
    await admin.save();
    }

  await mongoose.disconnect();
}

updateAdmin().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
