const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Report = require('../models/Report');

// GET /api/reports - patient sees own, doctor/admin sees all or by patientId
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'PATIENT') query.patientId = req.user._id;
    if (req.query.patientId) query.patientId = req.query.patientId;

    const reports = await Report.find(query)
      .populate('patientId', 'name email')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reports - any authenticated user can upload (patient uploads own, doctor uploads for patient)
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    const { patientId, title, reportDate, description } = req.body;

    // Determine the patient this report belongs to
    let targetPatientId = patientId;
    if (req.user.role === 'PATIENT') {
      // Patient always uploads for themselves
      const Patient = require('../models/Patient');
      const patientRecord = await Patient.findOne({ userId: req.user._id });
      if (!patientRecord) return res.status(404).json({ message: 'Patient record not found' });
      targetPatientId = req.user._id;
    }

    if (!targetPatientId) return res.status(400).json({ message: 'patientId is required' });
    if (!title) return res.status(400).json({ message: 'title is required' });

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const fileName = req.file ? req.file.originalname : null;
    const fileType = req.file
      ? (req.file.mimetype?.includes('pdf') ? 'pdf' : 'image')
      : null;

    const report = await Report.create({
      patientId: targetPatientId,
      title,
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      description,
      fileUrl,
      fileName,
      fileType,
      uploadedBy: req.user._id,
    });

    const populated = await Report.findById(report._id)
      .populate('patientId', 'name email')
      .populate('uploadedBy', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    // Only uploader or admin can delete
    if (req.user.role !== 'MAIN_DOCTOR' && report.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
