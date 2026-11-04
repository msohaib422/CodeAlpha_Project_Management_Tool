const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');


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
        const path = require('path');
        const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
        const filename = `${req.user._id}-${Date.now()}${ext}`;

        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { put } = require('@vercel/blob');
          const blob = await put(`profile-pictures/${filename}`, req.file.buffer, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          user.profilePicture = blob.url;
        } else {
          const fs = require('fs');
          const uploadDir = path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
          user.profilePicture = `/uploads/${filename}`;
        }
      } else if (req.body.profilePicture !== undefined) {
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
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
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

module.exports = {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getDashboardStats,
  getUsers,
  createUser,
  deleteUser,
};
