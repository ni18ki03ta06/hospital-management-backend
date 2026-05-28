const router = require('express').Router();
const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const { protect } = require('../middleware/auth');

// POST /api/auth/register
// Called after Firebase creates the user — registers them in MongoDB as PATIENT (pending approval)
router.post('/register', async (req, res) => {
  try {
    const { firebaseUid, name, email, age } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({ message: 'firebaseUid and email are required' });
    }

    // Verify the Firebase UID is valid
    try {
      await admin.auth().getUser(firebaseUid);
    } catch {
      return res.status(400).json({ message: 'Invalid Firebase user' });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const user = await User.create({
      name,
      email,
      firebaseUid,
      role: 'PATIENT',
    });

    await Patient.create({
      userId: user._id,
      age: age || 0,
      approvalStatus: 'PENDING',
    });

    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval.',
      code: 'PENDING_APPROVAL',
      user: { name, email },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
// Called after Firebase sign-in — returns the user's role and profile from MongoDB
router.post('/login', async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ message: 'firebaseUid is required' });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found in system. Please register first.' });
    }

    // Block PATIENT login if still PENDING or REJECTED
    if (user.role === 'PATIENT') {
      const patientRecord = await Patient.findOne({ userId: user._id });
      if (patientRecord && patientRecord.approvalStatus === 'PENDING') {
        return res.status(403).json({
          message: 'Your registration is pending admin approval. You will be notified once approved.',
          code: 'PENDING_APPROVAL',
        });
      }
      if (patientRecord && patientRecord.approvalStatus === 'REJECTED') {
        return res.status(403).json({
          message: 'Your registration has been rejected. Please contact the clinic.',
          code: 'REJECTED',
        });
      }
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword || false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/update-profile — update own name/email in MongoDB
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    user.mustChangePassword = false;

    await user.save();
    res.json({
      message: 'Profile updated',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword || false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/sync-firebase-user
// Called by admin when adding a doctor — creates Firebase Auth user + links to MongoDB
router.post('/sync-firebase-user', protect, async (req, res) => {
  try {
    const { userId, email, password } = req.body;

    if (req.user.role !== 'MAIN_DOCTOR') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const mongoUser = await User.findById(userId);
    if (!mongoUser) return res.status(404).json({ message: 'User not found' });

    // Create Firebase Auth user
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: email || mongoUser.email,
        password: password || 'temp@1234',
        displayName: mongoUser.name,
      });
    } catch (fbErr) {
      // If user already exists in Firebase, fetch them
      if (fbErr.code === 'auth/email-already-exists') {
        firebaseUser = await admin.auth().getUserByEmail(email || mongoUser.email);
      } else {
        throw fbErr;
      }
    }

    // Link Firebase UID to MongoDB user
    mongoUser.firebaseUid = firebaseUser.uid;
    await mongoUser.save();

    res.json({ message: 'Firebase user synced', firebaseUid: firebaseUser.uid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
