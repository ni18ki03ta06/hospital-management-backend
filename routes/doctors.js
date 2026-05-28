const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

// GET /api/doctors
router.get('/', protect, authorize('MAIN_DOCTOR', 'DOCTOR', 'PATIENT'), async (req, res) => {
  try {
    const doctors = await Doctor.find().populate('userId', 'name email');
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/doctors/referral-counts/monthly
// Returns how many patients each doctor referred to admin this calendar month
router.get('/referral-counts/monthly', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const Referral = require('../models/Referral');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const counts = await Referral.aggregate([
      {
        $match: {
          toAdmin: true,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$fromDoctor',
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert to { doctorUserId: count } map
    const map = {};
    counts.forEach(c => { map[c._id.toString()] = c.count; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/doctors/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('userId', 'name email');
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/doctors - MAIN_DOCTOR adds doctor
// Creates both MongoDB user and Firebase Auth account
router.post('/', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    const doctorPassword = password || 'temp@1234';

    let user = await User.findOne({ email });

    if (user) {
      if (user.role === 'DOCTOR') {
        const existingDoctor = await Doctor.findOne({ userId: user._id });
        if (existingDoctor) {
          return res.status(400).json({ message: 'This email is already registered as a doctor.' });
        }
        const doctor = await Doctor.create({ userId: user._id, specialization });
        const populated = await Doctor.findById(doctor._id).populate('userId', 'name email');
        return res.status(201).json({ user, doctor: populated });
      }
      // Existing user with different role — update to DOCTOR
      user.role = 'DOCTOR';
      if (name) user.name = name;
      await user.save();
      const Patient = require('../models/Patient');
      await Patient.deleteOne({ userId: user._id });

      // Ensure Firebase account exists and is linked
      await _ensureFirebaseUser(user, doctorPassword);

      const doctor = await Doctor.create({ userId: user._id, specialization });
      const populated = await Doctor.findById(doctor._id).populate('userId', 'name email');
      return res.status(201).json({ user, doctor: populated });
    }

    // New user — create MongoDB user first
    user = await User.create({
      name,
      email,
      password: doctorPassword,
      role: 'DOCTOR',
      mustChangePassword: !password,
    });

    // Create Firebase Auth account for the new doctor
    await _ensureFirebaseUser(user, doctorPassword);

    const doctor = await Doctor.create({ userId: user._id, specialization });
    const populated = await Doctor.findById(doctor._id).populate('userId', 'name email');
    res.status(201).json({ user, doctor: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/doctors/:id
router.delete('/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const user = await User.findById(doctor.userId);
    if (user) {
      // Delete from Firebase Auth if linked
      if (user.firebaseUid) {
        try {
          await admin.auth().deleteUser(user.firebaseUid);
        } catch (fbErr) {
          console.warn('Firebase user delete warning:', fbErr.message);
        }
      }
      await User.findByIdAndDelete(doctor.userId);
    }

    res.json({ message: 'Doctor removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper: create or fetch Firebase user and link UID to MongoDB user
async function _ensureFirebaseUser(mongoUser, password) {
  try {
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: mongoUser.email,
        password,
        displayName: mongoUser.name,
      });
    } catch (fbErr) {
      if (fbErr.code === 'auth/email-already-exists') {
        firebaseUser = await admin.auth().getUserByEmail(mongoUser.email);
      } else {
        throw fbErr;
      }
    }
    mongoUser.firebaseUid = firebaseUser.uid;
    await mongoUser.save();
  } catch (err) {
    console.error('Firebase user creation error:', err.message);
    // Non-fatal — doctor is still created in MongoDB
  }
}

module.exports = router;
