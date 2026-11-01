// Optional migration helper: uploads existing local /uploads files to Vercel Blob
// and updates user profilePicture URLs in MongoDB.
// Run manually only if needed: node scripts/migrate-uploads.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { put } = require('@vercel/blob');
const User = require('../models/User');

(async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is required');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const uploadDir = path.join(__dirname, '..', 'uploads');
  const users = await User.find({ profilePicture: /^\/uploads\// });
  for (const u of users) {
    const filename = u.profilePicture.replace('/uploads/', '');
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn('Missing file, skipping:', filePath);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    const blob = await put(`profile-pictures/${filename}`, buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    u.profilePicture = blob.url;
    await u.save();
    console.log('Migrated:', u._id, '->', blob.url);
  }
  await mongoose.disconnect();
  console.log('Done');
})();