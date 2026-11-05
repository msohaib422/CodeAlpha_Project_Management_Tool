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
  approveUser,
  rejectUser,
  updateUser,
  updateUserPassword,
} = require('../controllers/userController');
const { protect, userManagementAdmin } = require('../middleware/authMiddleware');
const upload = require('../utils/upload');

// Self-service routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, upload.single('profilePicture'), updateUserProfile);
router.get('/search', protect, searchUsers);
router.get('/dashboard', protect, getDashboardStats);

// User management routes (restricted to the single authorized administrator)
router.route('/')
  .get(protect, userManagementAdmin, getUsers)
  .post(protect, userManagementAdmin, createUser);

router.delete('/:id', protect, userManagementAdmin, deleteUser);
router.put('/:id/approve', protect, userManagementAdmin, approveUser);
router.put('/:id/reject', protect, userManagementAdmin, rejectUser);
router.put('/:id/password', protect, userManagementAdmin, updateUserPassword);
router.put('/:id', protect, userManagementAdmin, updateUser);

module.exports = router;