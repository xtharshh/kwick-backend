const mongoose = require('mongoose');

const workerProfileSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: true,
    unique: true
  },
  address: {
    type: String,
    required: true
  },
  landmark: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false
  },
  dob: {
    type: Date,
    required: false
  }
});

module.exports = mongoose.model('WorkerProfile', workerProfileSchema);