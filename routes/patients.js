const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');
const Patient = require('../models/Patient');

const DEFAULT_PASSWORD = 'temp@1234';

// Helper: create Firebase Auth user and link UID to MongoDB user
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
    console.error('Firebase patient user creation error:', err.message);
    // Non-fatal — patient is still created in MongoDB
  }
}

// GET /api/patients - MAIN_DOCTOR sees referred, assigned, or self-added approved patients. DOCTOR sees their assigned approved patients.
router.get('/', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'DOCTOR') {
      query.assignedDoctor = req.user._id;
      query.approvalStatus = 'APPROVED';
    }
    // MAIN_DOCTOR sees ALL approved patients — no filter
    const patients = await Patient.find(query)
      .populate('userId', 'name email')
      .populate('assignedDoctor', 'name email')
      .populate('addedBy', 'name email')
      .sort({ isActive: -1, createdAt: -1 });

    const validPatients = patients.filter(p => p.userId);
    res.json(validPatients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/admin-active - MAIN_DOCTOR sees patients currently referred to admin
router.get('/admin-active', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const patients = await Patient.find({ referredToAdmin: true, approvalStatus: 'APPROVED' })
      .populate('userId', 'name email')
      .populate('assignedDoctor', 'name email')
      .populate('addedBy', 'name email')
      .populate('prescriptions.addedBy', 'name')
      .sort({ createdAt: -1 });

    // Safeguard: Filter out orphaned patients
    const validPatients = patients.filter(p => p.userId);
    res.json(validPatients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/pending - MAIN_DOCTOR sees pending approvals
router.get('/pending', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const patients = await Patient.find({ approvalStatus: 'PENDING' })
      .populate('userId', 'name email')
      .populate('assignedDoctor', 'name email')
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 });

    // Safeguard: Filter out orphaned patients
    const validPatients = patients.filter(p => p.userId);
    res.json(validPatients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/me - patient views own profile
router.get('/me', protect, authorize('PATIENT'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id })
      .populate('userId', 'name email mustChangePassword')
      .populate('assignedDoctor', 'name email')
      .populate('prescriptions.addedBy', 'name');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('userId', 'name email mustChangePassword')
      .populate('assignedDoctor', 'name email')
      .populate('prescriptions.addedBy', 'name');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (req.user.role === 'PATIENT' && patient.userId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients - Add patient
// - DOCTOR: auto-APPROVED, assigned to this doctor, visible only to this doctor
// - MAIN_DOCTOR: auto-APPROVED, assigned to self
// - If email already exists: reassign that patient to this doctor (don't create duplicate)
// - Password always temp@1234 — never from frontend
router.post('/', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const { name, email, age, diagnosis, medicalHistory } = req.body;

    let user = null;
    let existingPatient = null;

    if (email && email.trim() !== '') {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Simple email validation regex check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid patient email address.' });
      }

      // Check if user with this email already exists
      user = await User.findOne({ email: trimmedEmail });
      if (user) {
        // Safe check: If existing user is a doctor or admin, block patient creation with this email
        if (user.role !== 'PATIENT') {
          return res.status(400).json({ message: 'This email is already registered as a doctor or admin.' });
        }

        // User exists — find their patient record
        existingPatient = await Patient.findOne({ userId: user._id });
        if (existingPatient) {
          // Reassign to this doctor, update any new info provided, mark active
          const updates = {
            assignedDoctor: req.user._id,
            isActive: true,
            approvalStatus: 'APPROVED',
          };
          if (age) updates.age = age;
          if (diagnosis) updates.diagnosis = diagnosis;
          if (medicalHistory) updates.medicalHistory = medicalHistory;
          if (name && user.name !== name) {
            await User.findByIdAndUpdate(user._id, { name });
          }
          const updated = await Patient.findByIdAndUpdate(existingPatient._id, updates, { new: true })
            .populate('userId', 'name email')
            .populate('assignedDoctor', 'name email');
          return res.status(200).json({ ...updated.toObject(), _reassigned: true });
        }
      }
    }

    // Create new user if needed
    if (!user) {
      const userEmail = (email && email.trim()) ? email.trim().toLowerCase() : `patient_${Date.now()}@clinic.local`;
      
      // Ensure generated/provided email does not conflict (safeguard)
      const emailExists = await User.findOne({ email: userEmail });
      if (emailExists) {
        return res.status(400).json({ message: 'A user with this email already exists in the system.' });
      }

      user = await User.create({
        name: name || 'Patient',
        email: userEmail,
        password: DEFAULT_PASSWORD,   // always use default — never from frontend
        role: 'PATIENT',
        mustChangePassword: true,
      });

      // Create Firebase Auth account for the new patient (only for real emails)
      if (!userEmail.endsWith('@clinic.local')) {
        await _ensureFirebaseUser(user, DEFAULT_PASSWORD);
      }
    }

    // Create patient record — always APPROVED, assigned to this doctor
    const patient = await Patient.create({
      userId: user._id,
      age: age || null,
      diagnosis: diagnosis || '',
      medicalHistory: medicalHistory || '',
      assignedDoctor: req.user._id,
      addedBy: req.user._id,
      approvalStatus: 'APPROVED', // No admin approval needed — doctor adds directly
      isActive: true,
    });

    const populated = await Patient.findById(patient._id)
      .populate('userId', 'name email mustChangePassword')
      .populate('assignedDoctor', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/patients/:id/approve - MAIN_DOCTOR approves patient (for self-registered patients)
router.put('/:id/approve', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const { assignedDoctor } = req.body;
    const update = { approvalStatus: 'APPROVED', isActive: true };
    if (assignedDoctor) update.assignedDoctor = assignedDoctor;
    const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('userId', 'name email').populate('assignedDoctor', 'name email');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id/reject
router.put('/:id/reject', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id, { approvalStatus: 'REJECTED' }, { new: true }
    ).populate('userId', 'name email');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id/toggle-active
router.put('/:id/toggle-active', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (req.user.role === 'DOCTOR' && patient.assignedDoctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    patient.isActive = !patient.isActive;
    await patient.save();
    const populated = await Patient.findById(patient._id)
      .populate('userId', 'name email')
      .populate('assignedDoctor', 'name email');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id/discharge - MAIN_DOCTOR discharges patient back to assigned doctor
router.put('/:id/discharge', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { referredToAdmin: false, isActive: true },
      { new: true }
    ).populate('userId', 'name email').populate('assignedDoctor', 'name email');
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id - update patient info
router.put('/:id', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('userId', 'name email').populate('assignedDoctor', 'name email');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients/:id/prescription
router.post('/:id/prescription', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const { title, description, medicines, endDate } = req.body;
    const prescriptionEntry = {
      title: title || 'Prescription',
      description: description || '',
      medicines: Array.isArray(medicines) ? medicines : [],
      endDate: endDate || null,
      addedBy: req.user._id,
    };
    await Patient.findByIdAndUpdate(req.params.id, { $push: { prescriptions: prescriptionEntry } });
    const patient = await Patient.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('assignedDoctor', 'name email')
      .populate('prescriptions.addedBy', 'name');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id/refer - reassign patient to another doctor
router.put('/:id/refer', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const { newDoctorId } = req.body;
    const patient = await Patient.findByIdAndUpdate(
      req.params.id, { assignedDoctor: newDoctorId }, { new: true }
    ).populate('userId', 'name email').populate('assignedDoctor', 'name email');
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'DOCTOR' && patient.assignedDoctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this patient' });
    }
    await User.findByIdAndDelete(patient.userId);
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Patient removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
