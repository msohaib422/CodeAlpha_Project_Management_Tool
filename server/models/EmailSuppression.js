const mongoose = require('mongoose');

const EmailSuppressionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    reason: {
      type: String,
      default: 'Email delivery failed',
    },
    category: {
      type: String,
      enum: ['recipient', 'infrastructure', 'unknown'],
      default: 'recipient',
    },
    failureCount: {
      type: Number,
      default: 1,
    },
    firstFailureAt: {
      type: Date,
      default: Date.now,
    },
    lastFailureAt: {
      type: Date,
      default: Date.now,
    },
    providerError: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['suppressed'],
      default: 'suppressed',
    },
    isPermanent: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailSuppression', EmailSuppressionSchema);