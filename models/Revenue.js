const mongoose = require('mongoose');

const revenueSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  source: { type: String, required: true },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Revenue', revenueSchema);
