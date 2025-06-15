const mongoose = require('mongoose');
const User = require('./models/userSchema'); // Ensure this path is correct

mongoose.connect('mongodb+srv://xtharshh2:Guddu-0987@cluster0.4gcty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.once('open', async () => {
  try {
    const duplicates = await User.aggregate([
      {
        $group: {
          _id: { mobileNumber: "$mobileNumber" },
          uniqueIds: { $addToSet: "$_id" },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    for (const dup of duplicates) {
      dup.uniqueIds.shift(); // Remove the first uniqueId, keeping one record
      await User.deleteMany({ _id: { $in: dup.uniqueIds } }); // Delete remaining duplicates
    }

    console.log('Duplicate removal process completed');
  } catch (error) {
    console.error('Error removing duplicates:', error);
  } finally {
    mongoose.connection.close();
  }
});
