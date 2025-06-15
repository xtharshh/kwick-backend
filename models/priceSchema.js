const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = priceSchema;