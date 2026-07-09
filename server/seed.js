const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    await connectDB();
    
    await User.deleteMany({
      $or: [
        { email: { $in: ['admin@example.com', 'user@example.com'] } },
        { username: { $in: ['admin', 'demouser'] } }
      ]
    });

    const adminUser = new User({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@gmail.com',
      password: '12345678',
      role: 'Admin'
    });

    await adminUser.save();

    console.log('Database seeded with Admin Account');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedUsers();
