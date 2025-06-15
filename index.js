const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./db'); // Ensure this path is correct
const User = require('./models/userSchema'); // Ensure this path is correct
const Worker = require('./models/workerSchema'); // Ensure this path is correct
const Transaction = require('./models/transaction'); // Ensure this path is correct
const ServiceBooking = require('./models/serviceBooking'); // Ensure this path is correct
const moment = require('moment'); // Add moment library
const { v4: uuidv4 } = require('uuid'); // Add uuid library
const http = require('http');
const socketIo = require('socket.io');
const ServiceRequest = require('./models/ServiceRequest');
const WorkerTransaction = require('./models/workerTransaction');
const WorkerHistory = require('./models/workerHistory');
const Profile = require('./models/profileSchema');
const WorkerProfile = require('./models/profileSchema'); // Add WorkerProfile
const Message = require('./models/messageSchema'); // Add Message model

const app = express();
const port = 3000;

// Enable CORS and whitelist the frontend’s origin
app.use(cors({
  origin: 'http://192.168.29.223:3000', // Replace with your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.json());

// Connect to MongoDB
connectDB();

const server = http.createServer(app);
const io = socketIo(server);

let users = {};
const customerRooms = new Map();

// Store active bids
const activeBids = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  // Assume roles are passed as query parameters for simplicity
  const role = socket.handshake.query.role; // 'customer' or 'worker'
  users[socket.id] = role;

  // Join customer room on connect
  socket.on('joinCustomerRoom', (customerId) => {
    const roomId = `customer:${customerId}`;
    socket.join(roomId);
    customerRooms.set(customerId, roomId);
  });

  socket.on('chatMessage', async (msg) => {
    const senderRole = users[socket.id];
    // Handle chat message
  });

  socket.on('bookingRequest', async (bookingDetails) => {
    console.log('Received booking request:', bookingDetails);
    // Broadcast booking request to workers
    for (let id in users) {
      if (users[id] === 'worker') {
        io.to(id).emit('bookingRequest', bookingDetails);
      }
    }
  });

  
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    delete users[socket.id];
    customerRooms.forEach((roomId, customerId) => {
      if (socket.rooms.has(roomId)) {
        customerRooms.delete(customerId);
      }
    });
  });

  // Worker updates price
  socket.on('updatePrice', async ({ bookingId, price, workerData }) => {
    try {
      console.log('[DEBUG] Received data:', { bookingId, price, workerData });

      // Validate inputs
      if (!bookingId || !price || !workerData) {
        throw new Error('Missing required data: bookingId, price, or workerData');
      }

      if (!workerData.mobileNumber) {
        throw new Error('Worker mobile number is required');
      }

      // Validate price
      if (!price || price <= 0) {
        throw new Error('Invalid price value');
      }

      // Find booking and worker with validation
      const booking = await ServiceBooking.findById(bookingId).populate('userId');
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      console.log('[DEBUG] Finding worker with mobile:', workerData.mobileNumber);
      const worker = await Worker.findOne({ mobileNumber: workerData.mobileNumber });
      if (!worker) {
        throw new Error(`Worker not found with mobile: ${workerData.mobileNumber}`);
      }

      // Update booking status and price
      booking.status = 'negotiating';
      booking.price = price;
      await booking.save();

      // Create bid data
      const bidData = {
        bookingId,
        price,
        workerDetails: {
          workerId: worker._id,
          firstName: worker.firstName,
          lastName: worker.lastName,
          location: worker.city
        },
        status: 'pending'
      };

      console.log('[DEBUG] Created bid data:', bidData);

      // Emit to customer if they exist
      if (booking.userId && booking.userId._id) {
        io.to(`customer:${booking.userId._id}`).emit('priceUpdate', bidData);
        console.log(`Price update sent to customer ${booking.userId._id}`);
      }

      // Send confirmation to worker
      socket.emit('priceUpdateSuccess', bidData);

    } catch (error) {
      console.error('[DEBUG] Error:', {
        message: error.message,
        stack: error.stack,
        data: { bookingId, price, workerData }
      });
      
      socket.emit('priceUpdateError', { 
        message: error.message,
        bookingId 
      });
    }
  });

  // Handle customer accepting bid
  socket.on('acceptBid', async ({ bookingId, price }) => {
    try {
      const booking = await ServiceBooking.findByIdAndUpdate(
        bookingId,
        { 
          status: 'confirmed',
          price 
        },
        { new: true }
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Notify worker and customer
      io.emit(`bidAccepted:${bookingId}`, { booking });
      
      // Clear bids for this booking
      activeBids.delete(bookingId);

    } catch (error) {
      console.error('Error accepting bid:', error);
      socket.emit('bidError', { message: error.message });
    }
  });

  // Handle customer declining bid
  socket.on('declineBid', async ({ bookingId }) => {
    try {
      const booking = await ServiceBooking.findByIdAndUpdate(
        bookingId,
        { status: 'pending' },
        { new: true }
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Notify worker
      io.emit(`bidDeclined:${bookingId}`);
      
      // Remove this bid
      const bids = activeBids.get(bookingId) || [];
      activeBids.set(bookingId, bids.filter(bid => bid.price !== booking.price));

    } catch (error) {
      console.error('Error declining bid:', error);
      socket.emit('bidError', { message: error.message });
    }
  });

  // Handle customer response
  socket.on('priceResponse', async ({ bookingId, accepted }) => {
    try {
      const status = accepted ? 'confirmed' : 'pending';
      
      const booking = await ServiceBooking.findByIdAndUpdate(
        bookingId,
        { status },
        { new: true }
      );

      io.emit(`bookingUpdate:${bookingId}`, { status });
    } catch (error) {
      console.error('Error handling price response:', error);
    }
  });
});

app.post('/api/messages', async (req, res) => {
  const { message, role } = req.body;
  const newMessage = new Message({ message, role });
  try {
    await newMessage.save();
    res.status(201).send(newMessage);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get('/api/messages', async (req, res) => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  try {
    const messages = await Message.find({ timestamp: { $gte: tenMinutesAgo } });
    res.send(messages);
  } catch (error) {
    res.status(500).send(error);
  }
});

// API Routes
app.post('/users/register', async (req, res) => {
  try {
    if (!req.body.mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    console.log('Registration request body:', req.body);
    const user = new User(req.body);
    const savedUser = await user.save();
    console.log('User saved:', savedUser);
    
    res.status(201).json(savedUser);
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'User with this mobile number already exists' 
      });
    }
    res.status(500).json({ message: error.message });
  }
});

// Fetch user profile
app.get('/users/profile', async (req, res) => {
  try {
    const mobileNumber = req.query.mobileNumber;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
app.put('/users/profile', async (req, res) => {
  try {
    const { mobileNumber, dob, ...updateData } = req.body;
    
    console.log('Update request body:', req.body); // Log the request body

    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    if (dob) {
      updateData.dob = moment(dob, 'DD/MM/YYYY').toDate(); // Parse and format dob
    }

    const user = await User.findOneAndUpdate(
      { mobileNumber },
      { $set: updateData },
      { 
        new: true,  // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch user profile by mobile number
app.get('/users/profile/:mobileNumber', async (req, res) => {
  try {
    const user = await User.findOne({ mobileNumber: req.params.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile by mobile number
app.put('/users/profile/:mobileNumber', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { mobileNumber: req.params.mobileNumber },
      req.body,
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch user details
app.get('/user/:phone', async (req, res) => {
  try {
    const user = await User.findOne({ mobileNumber: req.params.phone });
    res.json(user);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Fetch user details by mobile number
app.get('/users/:mobileNumber', async (req, res) => {
  try {
    const user = await User.findOne({ mobileNumber: req.params.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Update user balance
app.post('/user/update-balance', async (req, res) => {
  try {
    const { phone, balance } = req.body;
    const user = await User.findOneAndUpdate({ mobileNumber: phone }, { balance }, { new: true });
    res.json(user);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Fetch user details by user ID
app.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new transaction
app.post('/transactions', async (req, res) => {
  try {
    const { mobileNumber, type, amount, description } = req.body;
    if (!mobileNumber || !type || !amount || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newTransaction = new Transaction({
      mobileNumber,
      type,
      amount,
      description
    });

    await newTransaction.save();

    // Update user balance
    if (type === 'credit') {
      user.balance += amount;
    } else if (type === 'debit') {
      if (user.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }
      user.balance -= amount;
    } else {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    await user.save();

    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Error processing transaction:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch all transactions for a user by mobile number
app.get('/transactions/:mobileNumber', async (req, res) => {
  try {
    const user = await User.findOne({ mobileNumber: req.params.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transactions = await Transaction.find({ mobileNumber: req.params.mobileNumber }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch service history
app.get('/service-history/:userId', async (req, res) => {
  try {
    const serviceHistory = await ServiceHistory.find({ userId: req.params.userId });
    res.json(serviceHistory);
  } catch (error) {
    res.status(500).send(error);
  }
});
// Fetch user balance
app.get('/users/:userId/balance', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ balance: user.balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: error.message });
  }
});
// Fetch user balance by mobile number
app.get('/users/:mobileNumber/balance', async (req, res) => {
  try {
    const user = await User.findOne({ mobileNumber: req.params.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ balance: user.balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: error.message });
  }
});
// Create a new service booking
app.post('/service-booking', async (req, res) => {
  try {
    const { mobileNumber, selectedServices, numberOfRooms, date, time, comments, areas, price } = req.body;
    if (!time || !date || !numberOfRooms) {
      return res.status(400).json({ message: 'Time, date, and number of rooms are required' });
    }
    const newBooking = new ServiceBooking({
      mobileNumber,
      selectedServices,
      numberOfRooms,
      date,
      time,
      comments,
      areas,
      orderId: uuidv4(), // Generate a unique orderId
      status: 'pending', // Initial status
      price: price || 0 // Initialize price to 0 if not provided
    });

    await newBooking.save();

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch all service bookings for a user by mobile number
app.get('/service-booking/:mobileNumber', async (req, res) => {
  try {
    const serviceBookings = await ServiceBooking.find({ mobileNumber: req.params.mobileNumber });
    res.json(serviceBookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch service booking by orderId
app.get('/service-booking/order/:orderId', async (req, res) => {
  try {
    const serviceBooking = await ServiceBooking.findOne({ orderId: req.params.orderId });
    if (!serviceBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(serviceBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new service request
app.post('/service-request', async (req, res) => {
  try {
    const { customerId, description, price, location } = req.body;
    const serviceRequest = new ServiceRequest({ customerId, description, price, location });
    await serviceRequest.save();

    // Broadcast to nearby workers
    io.emit('new-service-request', serviceRequest);

    res.status(201).json(serviceRequest);
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch worker details by mobile number
app.get('/workers/profile/:mobileNumber', async (req, res) => {
  try {
    const profile = await WorkerProfile.findOne({ mobileNumber: req.params.mobileNumber });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch worker profile
app.get('/workers/profile', async (req, res) => {
  try {
    const mobileNumber = req.query.mobileNumber;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const worker = await Worker.findOne({ mobileNumber });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    res.json(worker);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.post('/workers/register', async (req, res) => {
  try {
    console.log('Worker registration request body:', req.body);
    const { mobileNumber, firstName, lastName, email, dob, street, landmark, city, state, pincode, age, balance } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const existingWorker = await Worker.findOne({ mobileNumber });
    if (existingWorker) {
      return res.status(409).json({ message: 'Worker with this mobile number already exists' });
    }

    const newWorker = new Worker({
      mobileNumber,
      firstName,
      lastName,
      email,
      dob,
      street,
      landmark,
      city,
      state,
      pincode,
      age,
      userType: 'worker',
      balance
    });

    const savedWorker = await newWorker.save();
    console.log('Worker registered:', savedWorker);
    res.status(201).json(savedWorker);
  } catch (error) {
    console.error('Worker registration error:', error);
    res.status(500).json({ message: error.message });
  }
});
// Update worker profile
app.put('/workers/profile', async (req, res) => {
  try {
    const { mobileNumber, dob, ...updateData } = req.body;
    
    console.log('Worker update request body:', req.body); // Log the request body

    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    if (dob) {
      updateData.dob = moment(dob, 'DD/MM/YYYY').toDate(); // Parse and format dob
    }

    const worker = await Worker.findOneAndUpdate(
      { mobileNumber },
      { $set: updateData },
      { 
        new: true,  // Return updated document
        runValidators: true // Run schema validators
      }
    );

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Worker profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update worker profile by mobile number
app.put('/workers/profile/:mobileNumber', async (req, res) => {
  try {
    const { firstName, lastName, email, dob, street, landmark, city, state, pincode, age, balance } = req.body;
    const worker = await Worker.findOneAndUpdate(
      { mobileNumber: req.params.mobileNumber },
      {
        firstName,
        lastName,
        email,
        dob,
        street,
        landmark,
        city,
        state,
        pincode,
        age,
        userType: 'worker', // Ensure userType is set to 'worker'
        balance
      },
      { new: true, runValidators: true }
    );
    if (!worker) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(worker);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Fetch worker profile by mobile number
app.get('/workers/:mobileNumber', async (req, res) => {
  try {
    console.log('Fetch worker profile by mobile number params:', req.params);
    const worker = await Worker.findOne({ mobileNumber: req.params.mobileNumber });
    if (!worker) {
      console.log('Worker profile not found for mobile number:', req.params.mobileNumber);
      return res.status(404).json({ message: 'Profile not found' });
    }
    console.log('Worker profile found:', worker);
    res.json(worker);
  } catch (error) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch worker history by mobile number
app.get('/workerHistory/:mobileNumber', async (req, res) => {
  try {
    const workerHistory = await WorkerHistory.find({ workerMobileNumber: req.params.mobileNumber })
      .populate('serviceId');
    res.json(workerHistory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch worker balance by mobile number
app.get('/workers/balance/:mobileNumber', async (req, res) => {
  try {
    const worker = await Worker.findOne({ mobileNumber: req.params.mobileNumber });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    res.json({ balance: worker.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch worker transactions by mobile number
app.get('/workerTransactions/:mobileNumber', async (req, res) => {
  try {
    const transactions = await Transaction.find({ mobileNumber: req.params.mobileNumber });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add money to worker's wallet
app.post('/workers/addMoney', async (req, res) => {
  try {
    const { mobileNumber, amount } = req.body;
    const worker = await Worker.findOne({ mobileNumber });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    worker.balance += amount;
    await worker.save();

    const transaction = new Transaction({
      mobileNumber,
      type: 'credit',
      amount,
      description: 'Money added to wallet',
      date: new Date()
    });
    await transaction.save();

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Withdraw money from worker's wallet
app.post('/workers/withdrawMoney', async (req, res) => {
  try {
    const { mobileNumber, amount } = req.body;
    const worker = await Worker.findOne({ mobileNumber });
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }
    if (worker.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    worker.balance -= amount;
    await worker.save();

    const transaction = new Transaction({
      mobileNumber,
      type: 'debit',
      amount,
      description: 'Money withdrawn from wallet',
      date: new Date()
    });
    await transaction.save();

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch all latest unconfirmed bookings with user details
app.get('/service-bookings/latest', async (req, res) => {
  try {
    console.log('Fetching latest bookings...');
    const pendingBookings = await ServiceBooking.find({ status: 'pending' })
      .sort({ date: -1, time: -1 })
      .populate('userId', 'firstName lastName mobileNumber city');
    
    console.log('Pending bookings:', pendingBookings);
    if (!pendingBookings.length) {
      console.log('No pending bookings found');
      return res.status(404).json({ message: 'No pending bookings found' });
    }
    res.json(pendingBookings);
  } catch (error) {
    console.error('Error fetching latest bookings:', error);
    res.status(500).json({ message: error.message });
  }
});

// Route to fetch all pending bookings
app.get('/service-booking/all-pending', async (req, res) => {
  try {
    console.log('Fetching all pending bookings...');
    const allPendingBookings = await ServiceBooking.find({ status: 'pending' });
    console.log('Pending bookings without populate:', allPendingBookings);

    const populatedBookings = await Promise.all(
      allPendingBookings.map(async (booking) => {
        return booking.populate('userId', 'firstName lastName mobileNumber city').execPopulate();
      })
    );

    console.log('All pending bookings with populated user details:', populatedBookings);
    res.json(populatedBookings);
  } catch (error) {
    console.error('Error fetching all pending bookings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Add REST API endpoint for price updates
app.post('/service-booking/:bookingId/price', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { price } = req.body;

    const booking = await ServiceBooking.findByIdAndUpdate(
      bookingId,
      {
        price,
        status: 'negotiating'
      },
      { new: true }
    ).populate('userId');

    // Emit socket event
    io.emit(`priceUpdate:${booking.userId._id}`, {
      bookingId,
      price,
      status: 'negotiating'
    });

    res.json(booking);

  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ message: error.message });
  }
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;