const express = require('express');
const router = express.Router();
const { loginUser, getMe, registerUser, refreshToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.post('/refresh', protect, refreshToken);

module.exports = router;
