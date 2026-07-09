const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  searchUsers,
  getDashboardStats,
  getUsers,
  createUser,
  deleteUser,
  getOrgRoles,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../utils/upload');

// Self-service routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, upload.single('profilePicture'), updateUserProfile);
router.get('/search', protect, searchUsers);
router.get('/dashboard', protect, getDashboardStats);
router.get('/roles', protect, getOrgRoles);

// Admin-only routes
router.route('/')
  .get(protect, authorize('Admin'), getUsers)
  .post(protect, authorize('Admin'), createUser);

router.delete('/:id', protect, authorize('Admin'), deleteUser);

module.exports = router;
