const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const LaunchPad = require('../models/LaunchPad');

// GET /api/launchpad - MAIN_DOCTOR views all; DOCTOR/PATIENT view their own submissions
router.get('/', protect, async (req, res) => {
  try {
    let ideas;
    if (req.user.role === 'MAIN_DOCTOR') {
      ideas = await LaunchPad.find()
        .populate('submittedBy', 'name email role')
        .sort({ createdAt: -1 });
    } else {
      ideas = await LaunchPad.find({ submittedBy: req.user._id })
        .populate('submittedBy', 'name email role')
        .sort({ createdAt: -1 });
    }
    res.json(ideas);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/launchpad - any authenticated user submits
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, driveLink, contact } = req.body;
    const idea = await LaunchPad.create({
      title, description, driveLink, contact,
      submittedBy: req.user._id
    });
    res.status(201).json(idea);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/launchpad/:id
router.delete('/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    await LaunchPad.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
