const Bid = require('../models/Bid');

exports.createBid = async (req, res) => {
  try {
    const bid = new Bid(req.body);
    await bid.save();
    res.status(201).json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id);
    if (!bid) {
      return res.status(404).json({ message: 'Bid not found' });
    }
    res.json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBid = async (req, res) => {
  try {
    const bid = await Bid.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bid) {
      return res.status(404).json({ message: 'Bid not found' });
    }
    res.json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteBid = async (req, res) => {
  try {
    const bid = await Bid.findByIdAndDelete(req.params.id);
    if (!bid) {
      return res.status(404).json({ message: 'Bid not found' });
    }
    res.json({ message: 'Bid deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
