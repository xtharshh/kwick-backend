const ServiceRequest = require('../models/ServiceRequest');

exports.createServiceRequest = async (req, res) => {
  try {
    const serviceRequest = new ServiceRequest(req.body);
    await serviceRequest.save();
    res.status(201).json(serviceRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getServiceRequest = async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest) {
      return res.status(404).json({ message: 'Service request not found' });
    }
    res.json(serviceRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateServiceRequest = async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!serviceRequest) {
      return res.status(404).json({ message: 'Service request not found' });
    }
    res.json(serviceRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteServiceRequest = async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findByIdAndDelete(req.params.id);
    if (!serviceRequest) {
      return res.status(404).json({ message: 'Service request not found' });
    }
    res.json({ message: 'Service request deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
