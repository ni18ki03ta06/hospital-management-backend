const mongoose = require('mongoose');
const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const Referral = require('../models/Referral');
const Patient = require('../models/Patient');
const User = require('../models/User');
const upload = require('../middleware/upload');

// GET /api/referrals
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'DOCTOR') query.fromDoctor = req.user._id;
    if (req.user.role === 'PATIENT') query.patientId = req.user._id;

    const referrals = await Referral.find(query)
      .populate('patientId', 'name email')
      .populate('fromDoctor', 'name email')
      .populate('toDoctor', 'name email')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(referrals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/referrals/cardiac-conditions
router.get('/cardiac-conditions', protect, (req, res) => {
  const { CARDIAC_CONDITIONS } = require('../models/Referral');
  res.json(CARDIAC_CONDITIONS);
});

// POST /api/referrals - DOCTOR creates referral to admin (Dr. Ravikant Patil)
// Handles three cases:
//   1. patientId provided (patient from doctor's list)
//   2. patientEmail provided + patient exists in DB → use that patient
//   3. patientEmail provided + patient NOT in DB → create new patient with temp@123
// Note: upload.single('photo') is used — for JSON requests without a file,
// multer still parses the body correctly when Content-Type is multipart/form-data.
// For plain JSON requests (no file), we fall back to req.body directly.
router.post('/', protect, authorize('DOCTOR'), upload.single('photo'), async (req, res) => {
  try {
    const { patientId, patientEmail, toDoctor, toAdmin, cardiacCondition, reason } = req.body;
    const isAdminReferral = toAdmin === 'true' || toAdmin === true;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Sanitize incoming IDs — treat empty strings / "undefined" / "null" as missing
    const cleanPatientId = patientId && String(patientId).trim() !== '' && patientId !== 'undefined' && patientId !== 'null'
      ? String(patientId).trim() : null;
    const cleanToDoctor = toDoctor && String(toDoctor).trim() !== '' && toDoctor !== 'undefined' && toDoctor !== 'null'
      ? String(toDoctor).trim() : null;

    let resolvedPatientUserId = null;
    let patientRecord = null;

    if (cleanPatientId && mongoose.Types.ObjectId.isValid(cleanPatientId)) {
      // Case 1: patient selected from dropdown — patientId is the User._id
      resolvedPatientUserId = cleanPatientId;
      patientRecord = await Patient.findOne({ userId: resolvedPatientUserId });
    } else if (patientEmail && patientEmail.trim()) {
      // Case 2 or 3: email provided
      const email = patientEmail.trim().toLowerCase();
      
      // Simple email validation regex check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid patient email address.' });
      }

      let existingUser = await User.findOne({ email });

      if (existingUser) {
        // Safe check: If existing user is a doctor or admin, block patient referral with this email
        if (existingUser.role !== 'PATIENT') {
          return res.status(400).json({ message: 'This email is already registered as a doctor or admin, not a patient.' });
        }

        // User exists — find or create patient record
        resolvedPatientUserId = existingUser._id;
        patientRecord = await Patient.findOne({ userId: existingUser._id });
        if (!patientRecord) {
          // User exists but no patient record — create one assigned to this doctor
          patientRecord = await Patient.create({
            userId: existingUser._id,
            assignedDoctor: req.user._id,
            addedBy: req.user._id,
            approvalStatus: 'APPROVED',
            isActive: true,
          });
        } else {
          // Patient record exists — make it assigned to this doctor, approved, and active
          patientRecord.assignedDoctor = req.user._id;
          patientRecord.isActive = true;
          patientRecord.approvalStatus = 'APPROVED';
          await patientRecord.save();
        }
      } else {
        // Case 3: User doesn't exist — create new patient with temp@1234
        const newUser = await User.create({
          name: email.split('@')[0], // use email prefix as name
          email,
          password: 'temp@1234',     // always hardcoded — never from frontend
          role: 'PATIENT',
          mustChangePassword: true,
        });
        resolvedPatientUserId = newUser._id;
        patientRecord = await Patient.create({
          userId: newUser._id,
          assignedDoctor: req.user._id,
          addedBy: req.user._id,
          approvalStatus: 'APPROVED',
          isActive: true,
        });
      }
    }

    // Explicit checkpoint: Return clean error if patient could not be resolved
    if (!resolvedPatientUserId) {
      return res.status(400).json({ message: 'Please select a valid patient from the dropdown or enter a valid patient email.' });
    }

    // Resolve target doctor ID
    let finalToDoctor = null;

    if (isAdminReferral) {
      // Find the main doctor (Dr. Ravikant Patil)
      const mainDoctor = await User.findOne({
        $or: [
          { role: 'MAIN_DOCTOR' },
          { role: 'admin' },
          { role: 'ADMIN' },
          { name: /Ravikant/i }
        ]
      });
      if (!mainDoctor) {
        return res.status(400).json({ message: 'Admin doctor account (Dr. Ravikant Patil) not found in the system.' });
      }
      finalToDoctor = mainDoctor._id;
    } else {
      // Standard doctor-to-doctor referral: toDoctor must be provided and valid
      if (!cleanToDoctor || !mongoose.Types.ObjectId.isValid(cleanToDoctor)) {
        return res.status(400).json({ message: 'A valid target doctor is required for standard referrals.' });
      }

      const targetDoctor = await User.findOne({ _id: cleanToDoctor, role: 'DOCTOR' });
      if (!targetDoctor) {
        return res.status(400).json({ message: 'The specified target doctor could not be found in the system.' });
      }
      finalToDoctor = targetDoctor._id;
    }

    // Build referral data
    const referralData = {
      patientId: resolvedPatientUserId,
      fromDoctor: req.user._id,
      toAdmin: isAdminReferral,
      toDoctor: finalToDoctor,
      cardiacCondition: isAdminReferral ? (cardiacCondition || '') : '',
      reason: reason || '',
      photoUrl,
      status: 'PENDING',
      patientEmail: patientEmail || '',
    };

    const referral = await Referral.create(referralData);

    // If referring to admin, mark patient as inactive at doctor side
    if (isAdminReferral && patientRecord) {
      await Patient.findByIdAndUpdate(patientRecord._id, {
        isActive: false,
        referredToAdmin: true,
      });
    }

    const populated = await Referral.findById(referral._id)
      .populate('patientId', 'name email')
      .populate('fromDoctor', 'name email')
      .populate('toDoctor', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/referrals/:id/approve - MAIN_DOCTOR approves
router.put('/:id/approve', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status: 'APPROVED', approvedBy: req.user._id },
      { new: true }
    ).populate('patientId', 'name email').populate('fromDoctor', 'name email');
    res.json(referral);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/referrals/:id/reject - MAIN_DOCTOR rejects, patient goes back to doctor
router.put('/:id/reject', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status: 'REJECTED', approvedBy: req.user._id },
      { new: true }
    ).populate('patientId', 'name email');

    if (referral?.patientId) {
      const pid = referral.patientId._id || referral.patientId;
      await Patient.findOneAndUpdate({ userId: pid }, { isActive: true, referredToAdmin: false });
    }
    res.json(referral);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/referrals/:id/discharge - MAIN_DOCTOR discharges patient back to original doctor
router.put('/:id/discharge', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status: 'DISCHARGED', dischargedAt: new Date() },
      { new: true }
    ).populate('patientId', 'name email').populate('fromDoctor', 'name email');

    if (referral?.patientId) {
      const pid = referral.patientId._id || referral.patientId;
      await Patient.findOneAndUpdate({ userId: pid }, { isActive: true, referredToAdmin: false });
    }
    res.json(referral);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
