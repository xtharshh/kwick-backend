const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const serviceBookingSchema = new mongoose.Schema({
  mobileNumber: {
    type: String,
    required: true
  },
  selectedServices: {
    type: [String],
    required: true
  },
  numberOfRooms: {
    type: Number,
    required: true
  },
  date: {
    type: Date, // Use Date type for correct sorting
    required: true
  },
  time: {
    type: String,
    required: true
  },
  comments: {
    type: String
  },
  areas: {
    type: [String],
    required: true
  },
  orderId: {
    type: String,
    default: uuidv4, // Automatically generate a unique orderId
    unique: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'negotiating'],
    default: 'pending'
  },
  price: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true
  }
}, { collection: 'servicebookings' }); // Ensure the collection name is correct

// Add compound index for date and time
serviceBookingSchema.index({ date: 1, time: 1 });

const ServiceBooking = mongoose.model('ServiceBooking', serviceBookingSchema);

module.exports = ServiceBooking;