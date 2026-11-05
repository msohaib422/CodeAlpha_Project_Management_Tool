const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { sendApproval, sendRejection, sendAdminCreatedUser } = require('../utils/emailService');
const { uploadProfileImage, deleteProfileImage } = require('../utils/cloudinary');


// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;

      if (req.file) {
        // Upload to Cloudinary first. If this fails, the existing picture is untouched.
        let uploaded;
        try {
          uploaded = await uploadProfileImage(req.file.buffer);
        } catch (uploadError) {
          return res.status(400).json({ message: uploadError.message || 'Profile image upload failed' });
        }

        const previousPublicId = user.profilePicturePublicId;
        user.profilePicture = uploaded.secure_url;
        user.profilePicturePublicId = uploaded.public_id;

        try {
          await user.save();
        } catch (saveError) {
          // Roll back the newly uploaded asset so we don't orphan it.
          try {
            await deleteProfileImage(uploaded.public_id);
          } catch (cleanupError) {
            console.error('[profile] rollback delete failed:', cleanupError.message);
          }
          throw saveError;
        }

        // Only delete the previous asset after the new one is stored successfully.
        if (previousPublicId && previousPublicId !== uploaded.public_id) {
          try {
            await deleteProfileImage(previousPublicId);
          } catch (deleteError) {
            console.error('[profile] failed to delete previous image:', deleteError.message);
          }
        }
      } else if (req.body && (req.body.removeProfilePicture === 'true' || req.body.removeProfilePicture === true)) {
        const previousPublicId = user.profilePicturePublicId;
        user.profilePicture = '';
        user.profilePicturePublicId = '';

        await user.save();

        if (previousPublicId) {
          try {
            await deleteProfileImage(previousPublicId);
          } catch (deleteError) {
            console.error('[profile] failed to delete removed image:', deleteError.message);
          }
        }
      } else if (req.body && req.body.profilePicture !== undefined) {
        user.profilePicture = req.body.profilePicture;
      }

      if (req.body.password) {
        if (req.body.currentPassword) {
          const matchedUser = await User.findById(req.user._id).select('+password');
          const isMatch = await matchedUser.matchPassword(req.body.currentPassword);
          if (!isMatch) {
            return res.status(400).json({ message: 'Current password does not match' });
          }
        }
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        profilePicturePublicId: updatedUser.profilePicturePublicId,
        bio: updatedUser.bio,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search users by username, email or name
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  const { query } = req.query;

  try {
    if (!query) return res.json([]);

    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { name: { $regex: query, $options: 'i' } },
          ],
        },
        { _id: { $ne: req.user._id } },
      ],
    })
      .select('_id name username email profilePicture')
      .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard metrics
// @route   GET /api/users/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Projects the user is a member of
    const userProjects = await Project.find({ 'members.user': userId }).select('_id');
    const userProjectIds = userProjects.map((p) => p._id);

    // Tasks assigned to user or in their projects
    const taskFilter = {
      $or: [
        { assignedTo: userId },
        { project: { $in: userProjectIds } },
      ],
    };

    const [assignedTasks, completedTasks, pendingTasks, totalProjects] = await Promise.all([
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, status: 'completed' }),
      Task.countDocuments({ ...taskFilter, status: { $in: ['todo', 'in_progress', 'review', 'submitted'] } }),
      Project.countDocuments({ 'members.user': userId }),
    ]);

    const [recentlyUpdatedTasks, latestNotifications, unreadNotificationsCount] = await Promise.all([
      Task.find(taskFilter)
        .populate('project', 'name')
        .populate('createdBy', 'name')
        .sort('-updatedAt')
        .limit(5),
      Notification.find({ recipient: userId })
        .populate('sender', 'name username profilePicture')
        .populate('project', 'name')
        .sort('-createdAt')
        .limit(5),
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    res.json({
      totalProjects,
      totalTasks: assignedTasks,
      completedTasks,
      pendingTasks,
      totalUsers: 0,
      recentlyUpdatedTasks,
      latestNotifications,
      unreadNotificationsCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort('name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create user (Admin only)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
  const { name, email, username, password } = req.body;

  try {
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    if (username) {
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    const user = await User.create({
      name,
      email,
      username: username || undefined,
      password: password || '12345678',
    });

    if (user) {
      // Send welcome email (no password included)
      sendAdminCreatedUser(user.email, user.name);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        status: user.status,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: 'User not found' });

    // Cannot delete yourself
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    // Clean up Cloudinary asset (best-effort) before removing the user.
    if (userToDelete.profilePicturePublicId) {
      try {
        await deleteProfileImage(userToDelete.profilePicturePublicId);
      } catch (cleanupError) {
        console.error('[deleteUser] cloudinary cleanup failed:', cleanupError.message);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    // Clean up references (remove from projects)
    await Project.updateMany(
      { 'members.user': req.params.id },
      { $pull: { members: { user: req.params.id } } }
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a pending user
// @route   PUT /api/users/:id/approve
// @access  Private
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'Pending Approval') {
      return res.status(400).json({ message: 'Registration already processed' });
    }
    user.status = 'Approved';
    user.isActive = true;
    await user.save();
    // Update relevant notifications: mark as read.
    try {
      await Notification.updateMany(
        { type: 'registration_request', relatedUser: user._id, read: false },
        { $set: { read: true } }
      );
    } catch (e) {
      console.error('[approve] notification update failed:', e.message);
    }
    // Email is best-effort and non-blocking.
    try {
      sendApproval(user.email, user.name);
    } catch (e) {
      console.error('[approve] email failed:', e.message);
    }
    res.json({ message: 'User approved', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a pending user
// @route   PUT /api/users/:id/reject
// @access  Private
const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status !== 'Pending Approval') {
      return res.status(400).json({ message: 'Registration already processed' });
    }
    user.status = 'Rejected';
    user.isActive = false;
    await user.save();
    try {
      await Notification.updateMany(
        { type: 'registration_request', relatedUser: user._id, read: false },
        { $set: { read: true } }
      );
    } catch (e) {
      console.error('[reject] notification update failed:', e.message);
    }
    try {
      sendRejection(user.email, user.name, req.body && req.body.reason);
    } catch (e) {
      console.error('[reject] email failed:', e.message);
    }
    res.json({ message: 'User rejected', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user details (admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin (single authorized email)
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, username, email } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'Name is required' });
      user.name = String(name).trim();
    }

    if (username !== undefined) {
      const normalizedUsername = String(username).trim().toLowerCase();
      if (normalizedUsername) {
        const existing = await User.findOne({ username: normalizedUsername, _id: { $ne: user._id } });
        if (existing) return res.status(400).json({ message: 'Username is already taken' });
        user.username = normalizedUsername;
      } else {
        user.username = undefined;
      }
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please add a valid email' });
      }
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) return res.status(400).json({ message: 'Email is already in use' });
      user.email = normalizedEmail;
    }

    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      username: updated.username,
      email: updated.email,
      status: updated.status,
      isActive: updated.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change a user's password (admin only)
// @route   PUT /api/users/:id/password
// @access  Private/Admin (single authorized email)
const updateUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { password, confirmPassword } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    user.password = password;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a user's profile image (admin only)
// @route   PUT /api/users/:id/profile-picture
// @access  Private/Admin
const updateUserProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.file) {
      let uploaded;
      try {
        uploaded = await uploadProfileImage(req.file.buffer);
      } catch (uploadError) {
        return res.status(400).json({ message: uploadError.message || 'Profile image upload failed' });
      }

      const previousPublicId = user.profilePicturePublicId;
      user.profilePicture = uploaded.secure_url;
      user.profilePicturePublicId = uploaded.public_id;

      try {
        await user.save();
      } catch (saveError) {
        try {
          await deleteProfileImage(uploaded.public_id);
        } catch (cleanupError) {
          console.error('[admin profile] rollback delete failed:', cleanupError.message);
        }
        throw saveError;
      }

      if (previousPublicId && previousPublicId !== uploaded.public_id) {
        try {
          await deleteProfileImage(previousPublicId);
        } catch (deleteError) {
          console.error('[admin profile] failed to delete previous image:', deleteError.message);
        }
      }
    } else if (req.body && (req.body.removeProfilePicture === 'true' || req.body.removeProfilePicture === true)) {
      const previousPublicId = user.profilePicturePublicId;
      user.profilePicture = '';
      user.profilePicturePublicId = '';

      await user.save();

      if (previousPublicId) {
        try {
          await deleteProfileImage(previousPublicId);
        } catch (deleteError) {
          console.error('[admin profile] failed to delete removed image:', deleteError.message);
        }
      }
    } else if (req.body && req.body.profilePicture !== undefined) {
      user.profilePicture = req.body.profilePicture;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      profilePicturePublicId: user.profilePicturePublicId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getDashboardStats,
  getUsers,
  createUser,
  deleteUser,
  approveUser,
  rejectUser,
  updateUser,
  updateUserPassword,
  updateUserProfileImage,
};
