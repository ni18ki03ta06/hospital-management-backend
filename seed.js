const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');
const Revenue = require('./models/Revenue');
const Expense = require('./models/Expense');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  // Only delete users/doctors — keep existing patients
  await Promise.all([User.deleteMany(), Doctor.deleteMany(), Patient.deleteMany()]);

  // ── ADMIN (Main Doctor) ──────────────────────────────
  await User.create({
    name: 'Dr. Ravikant Patil',
    email: 'shrikantmhaske05@gmail.com',
    password: 'admin',
    role: 'MAIN_DOCTOR'
  });

  // ── DOCTORS ─────────────────────────────────────────
  const doc1 = await User.create({ name: 'Dr. Sarah Johnson', email: 'sarah@hospital.com', password: 'Doctor@1234', role: 'DOCTOR' });
  const doc2 = await User.create({ name: 'Dr. Mike Chen',     email: 'mike@hospital.com',  password: 'Doctor@1234', role: 'DOCTOR' });
  const doc3 = await User.create({ name: 'Dr. Priya Sharma',  email: 'priya@hospital.com', password: 'Doctor@1234', role: 'DOCTOR' });

  await Doctor.create({ userId: doc1._id, specialization: 'Cardiology' });
  await Doctor.create({ userId: doc2._id, specialization: 'Neurology' });
  await Doctor.create({ userId: doc3._id, specialization: 'General Medicine' });

  await mongoose.disconnect();
}

seed().catch(console.error);
