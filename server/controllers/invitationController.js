const ProjectInvitation = require('../models/ProjectInvitation');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

// Helper: send real-time notification
const sendNotification = async (req, { recipientId, senderId, type, projectId, message }) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      project: projectId,
      message,
    });

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name username profilePicture')
      .populate('project', 'name');

    const io = req.app.get('io');
    if (io) {
      io.to(recipientId.toString()).emit('new_notification', populated);

      const unreadCount = await Notification.countDocuments({ recipient: recipientId, read: false });
      io.to(recipientId.toString()).emit('unread_count_update', { count: unreadCount });
    }

    return notification;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

// @desc    Send project invitation
// @route   POST /api/invitations
// @access  Private (Admin, or Project Manager for that specific project)
const inviteUser = async (req, res) => {
  const { projectId, inviteeEmail } = req.body;

  try {
    if (!projectId || !inviteeEmail) {
      return res.status(400).json({ message: 'Project and invitee email are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Admin OR the project's assigned PM (owner or member with PM role) can invite
    const isAdmin = req.user.role === 'Admin';
    const isProjectOwner = project.owner.toString() === req.user._id.toString();
    const isPMMember = project.members.some((m) => {
      const memberId = m.user ? (m.user._id || m.user).toString() : m.toString();
      return memberId === req.user._id.toString() && m.projectRole === 'Project Manager';
    });

    if (!isAdmin && !isProjectOwner && !isPMMember) {
      return res.status(403).json({
        message: 'Only the Admin or assigned Project Manager can invite members',
      });
    }

    // Find invitee by email
    const invitee = await User.findOne({ email: inviteeEmail.toLowerCase() });
    if (!invitee) return res.status(404).json({ message: 'No user found with that email address' });

    // Admin accounts don't need project invitations (they have system-wide access)
    if (invitee.role === 'Admin') {
      return res.status(400).json({ message: 'Admin accounts do not require project invitations' });
    }

    // Check if already a member
    const alreadyMember = project.members.some(
      (m) => m.user.toString() === invitee._id.toString()
    );
    if (alreadyMember) {
      return res.status(400).json({ message: `${invitee.name} is already a member of this project` });
    }

    // ── One-PM-per-project rule ──────────────────────────────────────────────
    // If the invitee is a Project Manager, ensure no PM already exists on this project
    if (invitee.role === 'Project Manager') {
      // Only non-Admins are blocked from inviting if a PM exists
      if (!isAdmin) {
        // Check if there is already a member with projectRole === 'Project Manager'
        const existingPMMember = project.members.find(
          (m) => m.projectRole === 'Project Manager' && m.user.toString() !== project.owner.toString()
        );
        if (existingPMMember) {
          return res.status(400).json({
            message: 'This project already has an assigned Project Manager. Only one Project Manager is allowed per project.',
          });
        }

        // Check if there is already a pending PM invitation
        const pendingPMInvite = await ProjectInvitation.findOne({
          project: projectId,
          status: 'Pending',
          projectRole: 'Project Manager',
        });
        if (pendingPMInvite) {
          return res.status(400).json({
            message: 'There is already a pending Project Manager invitation for this project.',
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check for existing pending invitation for this specific user
    const existingInvite = await ProjectInvitation.findOne({
      project: projectId,
      invitee: invitee._id,
      status: 'Pending',
    });
    if (existingInvite) {
      return res.status(400).json({ message: `A pending invitation already exists for ${invitee.name}` });
    }

    // Create invitation — use invitee's org role as project role automatically
    const invitation = await ProjectInvitation.create({
      project: projectId,
      invitee: invitee._id,
      inviter: req.user._id,
      projectRole: invitee.role, // Auto-use their organization role
      status: 'Pending',
    });

    // Send real-time notification to invitee
    await sendNotification(req, {
      recipientId: invitee._id,
      senderId: req.user._id,
      type: 'project_invitation',
      projectId: project._id,
      message: `${req.user.name} invited you to join project "${project.name}"`,
    });

    const populated = await ProjectInvitation.findById(invitation._id)
      .populate('project', 'name description')
      .populate('invitee', 'name email role profilePicture')
      .populate('inviter', 'name email profilePicture role');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get invitations for logged-in user
// @route   GET /api/invitations/my
// @access  Private
const getMyInvitations = async (req, res) => {
  try {
    const invitations = await ProjectInvitation.find({
      invitee: req.user._id,
      status: 'Pending',
    })
      .populate('project', 'name description')
      .populate('inviter', 'name email profilePicture role')
      .sort('-createdAt');

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get invitations sent for a project (owner/admin view)
// @route   GET /api/invitations/project/:projectId
// @access  Private (project owner or Admin)
const getProjectInvitations = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isAdmin = req.user.role === 'Admin';
    const isProjectOwner = project.owner.toString() === req.user._id.toString();
    const isPMInMembers = project.members.some(
      (m) => m.user.toString() === req.user._id.toString() && m.projectRole === 'Project Manager'
    );

    if (!isAdmin && !isProjectOwner && !isPMInMembers) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const invitations = await ProjectInvitation.find({
      project: req.params.projectId,
    })
      .populate('invitee', 'name email role department profilePicture')
      .populate('inviter', 'name email profilePicture')
      .sort('-createdAt');

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Respond to invitation (Accept or Reject)
// @route   PUT /api/invitations/:id/respond
// @access  Private
const respondToInvitation = async (req, res) => {
  const { status } = req.body; // 'Accepted' or 'Rejected'

  try {
    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Accepted or Rejected' });
    }

    const invitation = await ProjectInvitation.findById(req.params.id)
      .populate('project')
      .populate('inviter', 'name _id');

    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

    // Only the invitee can respond
    if (invitation.invitee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only respond to your own invitations' });
    }

    if (invitation.status !== 'Pending') {
      return res.status(400).json({ message: 'This invitation has already been responded to' });
    }

    invitation.status = status;
    await invitation.save();

    // Mark corresponding project_invitation notification as read
    try {
      await Notification.updateMany(
        {
          recipient: req.user._id,
          project: invitation.project._id,
          type: 'project_invitation',
          read: false,
        },
        { $set: { read: true } }
      );

      const io = req.app.get('io');
      if (io) {
        const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
        io.to(req.user._id.toString()).emit('unread_count_update', { count: unreadCount });
      }
    } catch (notifErr) {
      console.error('Error marking invitation notification as read:', notifErr.message);
    }

    if (status === 'Accepted') {
      // Add user to project members with their org role as project role
      const project = await Project.findById(invitation.project._id);

      const alreadyMember = project.members.some(
        (m) => m.user.toString() === req.user._id.toString()
      );

      if (!alreadyMember) {
        if (req.user.role === 'Project Manager') {
          // If the new joiner is a PM, downgrade any EXISTING PM members to 'Member'
          // IMPORTANT: Never downgrade the project owner's own record
          project.members.forEach(m => {
            const isOwner = m.user.toString() === project.owner.toString();
            if (m.projectRole === 'Project Manager' && !isOwner) {
              m.projectRole = 'Member';
            }
          });
        }

        project.members.push({
          user: req.user._id,
          projectRole: req.user.role, // Use org role automatically
        });
        await project.save();

        // Log activity
        await ActivityLog.create({
          project: project._id,
          user: req.user._id,
          action: 'Member Joined',
          details: `${req.user.name} accepted the invitation and joined the project as ${req.user.role}`,
        });

        // Notify the inviter
        await sendNotification(req, {
          recipientId: invitation.inviter._id,
          senderId: req.user._id,
          type: 'project_added',
          projectId: project._id,
          message: `${req.user.name} accepted your invitation to join project "${project.name}"`,
        });
      }
    } else {
      // Notify the inviter of rejection
      await sendNotification(req, {
        recipientId: invitation.inviter._id,
        senderId: req.user._id,
        type: 'project_added',
        projectId: invitation.project._id,
        message: `${req.user.name} declined your invitation to join project "${invitation.project.name}"`,
      });
    }

    res.json({ message: `Invitation ${status.toLowerCase()} successfully`, invitation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel (delete) an invitation
// @route   DELETE /api/invitations/:id
// @access  Private (inviter or Admin)
const cancelInvitation = async (req, res) => {
  try {
    const invitation = await ProjectInvitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

    if (
      req.user.role !== 'Admin' &&
      invitation.inviter.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to cancel this invitation' });
    }

    await invitation.deleteOne();
    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  inviteUser,
  getMyInvitations,
  getProjectInvitations,
  respondToInvitation,
  cancelInvitation,
};
