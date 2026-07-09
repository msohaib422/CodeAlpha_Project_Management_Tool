const mongoose = require('mongoose');

const ProjectInvitationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectRole: {
      type: String,
      required: true,
      default: 'Backend Developer',
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate pending invitations for the same user+project
ProjectInvitationSchema.index({ project: 1, invitee: 1, status: 1 });

module.exports = mongoose.model('ProjectInvitation', ProjectInvitationSchema);
