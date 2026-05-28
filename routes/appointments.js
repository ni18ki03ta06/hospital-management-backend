const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');

// GET /api/appointments
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'DOCTOR') query.doctorId = req.user._id;
    if (req.user.role === 'PATIENT') query.patientId = req.user._id;

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email')
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/appointments
router.post('/', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const appt = await Appointment.create(req.body);
    res.status(201).json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/appointments/:id
router.put('/:id', protect, authorize('MAIN_DOCTOR', 'DOCTOR'), async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
