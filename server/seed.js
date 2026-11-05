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
  // Safety guard: seed script must never run against production unless explicitly allowed.
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    console.error('[seed] Refusing to run: set ALLOW_DESTRUCTIVE_SEED=true to acknowledge this is a non-production seed operation.');
    process.exit(1);
  }

  try {
    await connectDB();

    // Non-destructive: do not delete or overwrite existing users.
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('[seed] Admin user already exists; skipping seed.');
      process.exit(0);
    }

    const adminUser = new User({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@gmail.com',
      password: '12345678',
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
