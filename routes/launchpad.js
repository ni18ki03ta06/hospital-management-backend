const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const LaunchPad = require('../models/LaunchPad');
const { STAGES } = require('../models/LaunchPad');

// GET /api/launchpad - MAIN_DOCTOR and DOCTOR see all; PATIENT sees own only
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'PATIENT') {
      query = { submittedBy: req.user._id };
    }
    // MAIN_DOCTOR and DOCTOR both see all ideas
    const ideas = await LaunchPad.find(query)
      .populate('submittedBy', 'name email role')
      .sort({ createdAt: -1 });
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
      submittedBy: req.user._id,
      stage: 'SUBMITTED',
    });
    res.status(201).json(idea);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/launchpad/:id/stage - MAIN_DOCTOR updates pipeline stage
router.put('/:id/stage', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const { stage, stageNote } = req.body;
    if (!STAGES.includes(stage)) {
      return res.status(400).json({ message: `Invalid stage: ${stage}. Valid stages: ${STAGES.join(', ')}` });
    }
    const idea = await LaunchPad.findByIdAndUpdate(
      req.params.id,
      { stage, stageNote: stageNote || '', stageUpdatedAt: new Date() },
      { new: true }
    ).populate('submittedBy', 'name email role');
    if (!idea) return res.status(404).json({ message: 'Idea not found' });
    res.json(idea);
  } catch (err) {
    console.error('Stage update error:', err.message);
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
