const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Referral = require('../models/Referral');
const ChatToken = require('../models/ChatToken');
const Revenue = require('../models/Revenue');
const Expense = require('../models/Expense');

// GET /api/dashboard - MAIN_DOCTOR analytics
router.get('/', protect, authorize('MAIN_DOCTOR'), async (req, res) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      totalAppointments,
      pendingReferrals,
      pendingTokens,
      revenues,
      expenses
    ] = await Promise.all([
      User.countDocuments({ role: 'PATIENT' }),
      User.countDocuments({ role: 'DOCTOR' }),
      Appointment.countDocuments(),
      Referral.countDocuments({ status: 'PENDING' }),
      ChatToken.countDocuments({ status: 'PENDING' }),
      Revenue.find(),
      Expense.find()
    ]);

    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      pendingReferrals,
      pendingTokens,
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
