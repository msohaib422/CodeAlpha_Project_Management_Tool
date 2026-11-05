const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ user: 1, used: 1, expiresAt: 1 });

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);