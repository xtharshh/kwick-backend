const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
    enum: ['customer', 'worker'],
    required: [true, 'User type is required']
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
userSchema.pre('save', function(next) {
  if (!this.mobileNumber) {
    next(new Error('Mobile number is required'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);