const express = require('express');
const router = express.Router();
const { loginUser, getMe, registerUser, refreshToken, verifyOtp, resendOtp, forgotPassword, validateResetToken, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', validateResetToken);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.post('/refresh', protect, refreshToken);

module.exports = router;