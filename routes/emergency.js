const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const Emergency = require('../models/Emergency');

// POST /api/emergency - any logged in user triggers emergency
router.post('/', protect, async (req, res) => {
  try {
    const { message } = req.body;

    // If patient, find their assigned doctor and include in emergency record
    let assignedDoctorId = null;
    if (req.user.role === 'PATIENT') {
      const Patient = require('../models/Patient');
      const patientRecord = await Patient.findOne({ userId: req.user._id });
      if (patientRecord?.assignedDoctor) {
        assignedDoctorId = patientRecord.assignedDoctor;
      }
    }

    const emergency = await Emergency.create({
      requestedBy: req.user._id,
      role: req.user.role === 'MAIN_DOCTOR' ? 'DOCTOR' : req.user.role,
      message: message || 'Emergency assistance needed!',
      status: 'ACTIVE',
      assignedDoctor: assignedDoctorId,
    });
    const populated = await Emergency.findById(emergency._id)
      .populate('requestedBy', 'name email role')
      .populate('assignedDoctor', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/emergency - MAIN_DOCTOR sees all, DOCTOR sees only their assigned patient emergencies
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'DOCTOR') {
      query.assignedDoctor = req.user._id;
    }
    const emergencies = await Emergency.find(query)
      .populate('requestedBy', 'name email role')
      .populate('assignedDoctor', 'name email')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(emergencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/emergency/:id/resolve - MAIN_DOCTOR or DOCTOR resolves
router.put('/:id/resolve', protect, async (req, res) => {
  try {
    const emergency = await Emergency.findByIdAndUpdate(
      req.params.id,
      { status: 'RESOLVED', resolvedBy: req.user._id, resolvedAt: new Date() },
      { new: true }
    ).populate('requestedBy', 'name email role');
    res.json(emergency);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
