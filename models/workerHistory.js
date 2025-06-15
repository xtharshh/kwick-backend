const mongoose = require('mongoose');

const workerHistorySchema = new mongoose.Schema({
  workerMobileNumber: {
    type: String,
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  customerMobileNumber: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('WorkerHistory', workerHistorySchema);