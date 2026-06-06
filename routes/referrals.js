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

// GET /api/referrals/reports — grouped by doctor, with date filtering
// MUST be before /:id route to avoid "reports" being treated as an id
router.get('/reports', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
      };
    }

    const referrals = await Referral.find({ toAdmin: true, ...dateFilter })
      .populate('fromDoctor', 'name email specialization')
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 });

    const doctorMap = {};
    referrals.forEach(ref => {
      const doc = ref.fromDoctor;
      if (!doc) return;
      const docId = doc._id.toString();
      if (!doctorMap[docId]) {
        doctorMap[docId] = {
          doctor: {
            _id: docId,
            name: doc.name,
            email: doc.email,
            specialization: doc.specialization || '',
          },
          totalReferrals: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          discharged: 0,
          referrals: [],
        };
      }
      doctorMap[docId].totalReferrals += 1;
      const status = (ref.status || '').toLowerCase();
      if (status === 'approved')   doctorMap[docId].approved   += 1;
      else if (status === 'rejected')  doctorMap[docId].rejected  += 1;
      else if (status === 'pending')   doctorMap[docId].pending   += 1;
      else if (status === 'discharged') doctorMap[docId].discharged += 1;

      doctorMap[docId].referrals.push({
        _id: ref._id,
        patientName:     ref.patientId?.name  || ref.patientEmail || 'Unknown Patient',
        patientEmail:    ref.patientId?.email || ref.patientEmail || '',
        status:          ref.status,
        cardiacCondition: ref.cardiacCondition || '',
        reason:          ref.reason || '',
        createdAt:       ref.createdAt,
        photoUrl:        ref.photoUrl || null,
      });
    });

    const result = Object.values(doctorMap).sort((a, b) => b.totalReferrals - a.totalReferrals);

    res.json({
      totalReferrals: referrals.length,
      totalDoctors:   result.length,
      dateRange:      { startDate, endDate },
      doctors:        result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

    const cleanPatientId = patientId && String(patientId).trim() !== '' && patientId !== 'undefined' && patientId !== 'null'
      ? String(patientId).trim() : null;
    const cleanToDoctor = toDoctor && String(toDoctor).trim() !== '' && toDoctor !== 'undefined' && toDoctor !== 'null'
      ? String(toDoctor).trim() : null;

    let resolvedPatientUserId = null;
    let patientRecord = null;

    if (cleanPatientId && mongoose.Types.ObjectId.isValid(cleanPatientId)) {
      resolvedPatientUserId = cleanPatientId;
      patientRecord = await Patient.findOne({ userId: resolvedPatientUserId });
    } else if (patientEmail && patientEmail.trim()) {
      const email = patientEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid patient email address.' });
      }
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        if (existingUser.role !== 'PATIENT') {
          return res.status(400).json({ message: 'This email is already registered as a doctor or admin, not a patient.' });
        }
        resolvedPatientUserId = existingUser._id;
        patientRecord = await Patient.findOne({ userId: existingUser._id });
        if (!patientRecord) {
          patientRecord = await Patient.create({
            userId: existingUser._id,
            assignedDoctor: req.user._id,
            addedBy: req.user._id,
            approvalStatus: 'APPROVED',
            isActive: true,
          });
        } else {
          patientRecord.assignedDoctor = req.user._id;
          patientRecord.isActive = true;
          patientRecord.approvalStatus = 'APPROVED';
          await patientRecord.save();
        }
      } else {
        const newUser = await User.create({
          name: email.split('@')[0],
          email,
          password: 'temp@1234',
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

    // ALL FIELDS OPTIONAL — allow referral with no patient info (admin can add patient later)
    let finalToDoctor = null;
    if (isAdminReferral) {
      const mainDoctor = await User.findOne({
        $or: [{ role: 'MAIN_DOCTOR' }, { role: 'admin' }, { role: 'ADMIN' }, { name: /Ravikant/i }]
      });
      if (!mainDoctor) {
        return res.status(400).json({ message: 'Admin doctor account not found in the system.' });
      }
      finalToDoctor = mainDoctor._id;
    } else {
      if (!cleanToDoctor || !mongoose.Types.ObjectId.isValid(cleanToDoctor)) {
        return res.status(400).json({ message: 'A valid target doctor is required for standard referrals.' });
      }
      const targetDoctor = await User.findOne({ _id: cleanToDoctor, role: 'DOCTOR' });
      if (!targetDoctor) {
        return res.status(400).json({ message: 'The specified target doctor could not be found.' });
      }
      finalToDoctor = targetDoctor._id;
    }

    const referralData = {
      patientId: resolvedPatientUserId || undefined,
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

// POST /api/referrals/:id/add-patient — Admin manually adds patient from referral detail
router.post('/:id/add-patient', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });

    const { name, email, age, assignedDoctor } = req.body;

    // If referral already has a patient, just return it
    if (referral.patientId) {
      return res.status(400).json({ message: 'This referral already has a patient linked.' });
    }

    const patientEmail = email || referral.patientEmail || `patient_${Date.now()}@clinic.local`;
    let user = await User.findOne({ email: patientEmail });

    if (!user) {
      user = await User.create({
        name: name || patientEmail.split('@')[0],
        email: patientEmail,
        password: 'temp@1234',
        role: 'PATIENT',
        mustChangePassword: true,
      });
    }

    let patientRecord = await Patient.findOne({ userId: user._id });
    if (!patientRecord) {
      patientRecord = await Patient.create({
        userId: user._id,
        age: age || 0,
        assignedDoctor: assignedDoctor || null,
        addedBy: req.user._id,
        approvalStatus: 'APPROVED',
        isActive: false,
        referredToAdmin: true,
      });
    }

    referral.patientId = user._id;
    if (email) referral.patientEmail = email;
    await referral.save();

    const populated = await Referral.findById(referral._id)
      .populate('patientId', 'name email')
      .populate('fromDoctor', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
