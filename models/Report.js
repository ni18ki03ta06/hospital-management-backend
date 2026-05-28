const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  reportDate: { type: Date },
  description: { type: String },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String }, // 'pdf' | 'image'
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
