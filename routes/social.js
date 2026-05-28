const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const SocialPost = require('../models/SocialPost');

// GET /api/social - all authenticated users can view
router.get('/', protect, async (req, res) => {
  try {
    const posts = await SocialPost.find()
      .populate('postedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/social - MAIN_DOCTOR only
router.post('/', protect, authorize('MAIN_DOCTOR'), upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const post = await SocialPost.create({ title, content, imageUrl, postedBy: req.user._id });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/social/:id - MAIN_DOCTOR only
router.delete('/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    await SocialPost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
