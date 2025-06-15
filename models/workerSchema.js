const mongoose = require('mongoose');

// Drop existing indexes
mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.collections.workers.dropIndexes();
  } catch (error) {
    console.log('No indexes to drop');
  }
});

const workerSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  dob: {
    type: Date
  },
  street: {
    type: String,
    default: ''
  },
  landmark: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  pincode: {
    type: String,
    default: ''
  },
  age: {
    type: String,
    default: ''
  },
  userType: {
    type: String,
    enum: ['worker'],

  },
  balance: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save middleware
workerSchema.pre('save', function(next) {
  if (!this.mobileNumber) {
    next(new Error('Mobile number is required'));
  }
  next();
});

module.exports = mongoose.model('Worker', workerSchema);