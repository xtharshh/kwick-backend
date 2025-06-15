const mongoose = require('mongoose');

const workerTransactionSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WorkerTransaction', workerTransactionSchema);