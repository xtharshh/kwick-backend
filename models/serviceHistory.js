const mongoose = require('mongoose');

const serviceHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  serviceProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  serviceDate: {
    type: Date,
    required: true
  },
  serviceTime: String,
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    required: true
  }
}, { timestamps: true });

const ServiceHistory = mongoose.model('ServiceHistory', serviceHistorySchema);
module.exports = ServiceHistory;
