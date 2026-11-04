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
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../utils/upload');

// Self-service routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, upload.single('profilePicture'), updateUserProfile);
router.get('/search', protect, searchUsers);
router.get('/dashboard', protect, getDashboardStats);

// User management routes (equal access)
router.route('/')
  .get(protect, getUsers)
  .post(protect, createUser);

router.delete('/:id', protect, deleteUser);
router.put('/:id/approve', protect, approveUser);
router.put('/:id/reject', protect, rejectUser);

module.exports = router;
