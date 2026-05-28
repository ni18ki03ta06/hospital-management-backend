const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ChatToken = require('../models/ChatToken');
const Patient = require('../models/Patient');
const { v4: uuidv4 } = require('uuid');

// GET /api/chat-token
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'PATIENT') query.patientId = req.user._id;
    if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
    const tokens = await ChatToken.find(query)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email')
      .sort({ createdAt: -1 });
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat-token/request - PATIENT requests chat/video — ALWAYS goes to assigned doctor
router.post('/request', protect, authorize('PATIENT'), async (req, res) => {
  try {
    const { type = 'CHAT' } = req.body;

    // Always find assigned doctor — no admin option
    const patientRecord = await Patient.findOne({ userId: req.user._id, approvalStatus: 'APPROVED' });
    if (!patientRecord || !patientRecord.assignedDoctor) {
      return res.status(400).json({ message: 'No assigned doctor found. Please contact the clinic.' });
    }

    const token = await ChatToken.create({
      patientId: req.user._id,
      token: uuidv4(),
      type,
      status: 'PENDING',
      requestedTo: 'DOCTOR',
      doctorId: patientRecord.assignedDoctor,
    });
    res.status(201).json(token);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/chat-token/:id/approve - DOCTOR approves with optional scheduled time
router.put('/:id/approve', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const chatToken = await ChatToken.findById(req.params.id);
    if (!chatToken) return res.status(404).json({ message: 'Token not found' });

    let doctorId = chatToken.doctorId;

    if (req.user.role === 'MAIN_DOCTOR') {
      if (!doctorId && !req.body.doctorId)
        return res.status(400).json({ message: 'Please assign a doctor before approving' });
      if (req.body.doctorId) doctorId = req.body.doctorId;
    } else if (req.user.role === 'DOCTOR') {
      if (!chatToken.doctorId || chatToken.doctorId.toString() !== req.user._id.toString())
        return res.status(403).json({ message: 'Not authorized to approve this request' });
      doctorId = req.user._id;
    }

    // Doctor can schedule a specific start time, or default to now
    let startTime, endTime;
    if (req.body.scheduledTime) {
      startTime = new Date(req.body.scheduledTime);
    } else {
      startTime = new Date();
    }
    endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    const token = await ChatToken.findByIdAndUpdate(
      req.params.id,
      { status: 'ACTIVE', startTime, endTime, approvedBy: req.user._id, doctorId },
      { new: true }
    ).populate('patientId', 'name email').populate('doctorId', 'name email');
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/chat-token/:id/reject
router.put('/:id/reject', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const chatToken = await ChatToken.findById(req.params.id);
    if (!chatToken) return res.status(404).json({ message: 'Token not found' });
    if (req.user.role === 'DOCTOR') {
      if (!chatToken.doctorId || chatToken.doctorId.toString() !== req.user._id.toString())
        return res.status(403).json({ message: 'Not authorized' });
    }
    const token = await ChatToken.findByIdAndUpdate(req.params.id, { status: 'REJECTED' }, { new: true });
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat-token/validate/:token
router.get('/validate/:token', protect, async (req, res) => {
  try {
    const chatToken = await ChatToken.findOne({ token: req.params.token, status: 'ACTIVE' });
    if (!chatToken) return res.status(403).json({ message: 'Token invalid or expired' });
    res.json({ valid: true, chatToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
