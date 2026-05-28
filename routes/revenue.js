const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const Revenue = require('../models/Revenue');
const Expense = require('../models/Expense');

// Revenue
router.get('/revenue', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  const data = await Revenue.find().sort({ date: -1 });
  res.json(data);
});

router.post('/revenue', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  const item = await Revenue.create(req.body);
  res.status(201).json(item);
});

router.delete('/revenue/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  await Revenue.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// Expenses
router.get('/expense', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  const data = await Expense.find().sort({ date: -1 });
  res.json(data);
});

router.post('/expense', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  const item = await Expense.create(req.body);
  res.status(201).json(item);
});

router.delete('/expense/:id', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
