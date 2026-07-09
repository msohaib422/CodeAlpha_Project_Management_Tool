const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { ORG_ROLES } = require('../models/User');

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
        user.profilePicture = `/uploads/${req.file.filename}`;
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
        role: updatedUser.role,
        department: updatedUser.department,
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
      .select('_id name username email profilePicture role department')
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
    const isAdmin = req.user.role === 'Admin';

    // Find projects managed by the user (owner OR projectRole: 'Project Manager')
    const managedProjects = await Project.find({
      $or: [
        { owner: userId },
        { members: { $elemMatch: { user: userId, projectRole: 'Project Manager' } } },
      ],
    });
    const managedProjectIds = managedProjects.map((p) => p._id);

    // Combined task filter: Personally assigned OR within managed projects
    const taskFilter = {
      $or: [
        { assignedTo: userId },
        { project: { $in: managedProjectIds } },
      ],
    };

    // If Admin, they see everything managed in the system by default
    const finalTaskFilter = isAdmin ? {} : taskFilter;

    const assignedTasks = await Task.countDocuments(finalTaskFilter);
    const completedTasks = await Task.countDocuments({ ...finalTaskFilter, status: 'completed' });
    const pendingTasks = await Task.countDocuments({
      ...finalTaskFilter,
      status: { $in: ['todo', 'in_progress', 'review', 'submitted'] },
    });

    // For Admins: also keep system-wide totals for context
    const totalProjects = isAdmin
      ? await Project.countDocuments({})
      : await Project.countDocuments({ 'members.user': userId });

    const totalTasks = assignedTasks; // "Assigned Tasks" card = managed + personally assigned

    const recentlyUpdatedTasks = await Task.find(finalTaskFilter)
      .populate('project', 'name')
      .populate('createdBy', 'name')
      .sort('-updatedAt')
      .limit(5);

    const latestNotifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name username profilePicture')
      .populate('project', 'name')
      .sort('-createdAt')
      .limit(5);

    const unreadNotificationsCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    // Admin extra stats
    let totalUsers = 0;
    if (isAdmin) {
      totalUsers = await User.countDocuments({});
    }

    res.json({
      totalProjects,
      totalTasks,
      completedTasks,
      pendingTasks,
      totalUsers,
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
  const { name, email, username, role, department, phoneNumber, employeeId, password } = req.body;

  try {
    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Name, email, and role are required' });
    }

    // Block creating another Admin
    if (role === 'Admin') {
      return res.status(403).json({ message: 'Cannot create another Admin. Only one Admin is allowed.' });
    }

    // Validate role
    if (!ORG_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role: ${role}` });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    if (username) {
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    if (phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber: phoneNumber.trim() });
      if (phoneExists) {
        return res.status(400).json({ message: 'Phone number already exists' });
      }
    }

    if (employeeId) {
      const employeeIdExists = await User.findOne({ employeeId: employeeId.trim() });
      if (employeeIdExists) {
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
    }

    const user = await User.create({
      name,
      email,
      username: username || undefined,
      role,
      department: department || '',
      phoneNumber: phoneNumber || undefined,
      employeeId: employeeId || undefined,
      password: password || '12345678',
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: 'User not found' });

    // Cannot delete Admin
    if (userToDelete.role === 'Admin') {
      return res.status(403).json({ message: 'Cannot delete the Admin account' });
    }

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

// @desc    Get available org roles
// @route   GET /api/users/roles
// @access  Private
const getOrgRoles = async (req, res) => {
  // Never expose Admin as a creatable role
  const roles = ORG_ROLES.filter((r) => r !== 'Admin');
  res.json(roles);
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getDashboardStats,
  getUsers,
  createUser,
  deleteUser,
  getOrgRoles,
};
