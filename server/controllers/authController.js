const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const { sendOTP } = require('../utils/emailService');

// @desc    Register a new user (step 1: send OTP)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, username, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    if (username) {
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Generate 6-digit OTP
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.create({
      name,
      username: username || undefined,
      email,
      password,
      status: 'Pending Verification',
      otp: hashedOtp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOTP(user.email, otp);

    res.status(201).json({ message: 'OTP sent to your email. Please verify to continue registration.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify registration OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otp +otpExpires');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status !== 'Pending Verification') {
      return res.status(400).json({ message: 'Registration already processed' });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashedOtp !== user.otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Move to pending approval
    user.status = 'Pending Approval';
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send emails
    const { sendRegistrationConfirmation, sendAdminNewRegistration } = require('../utils/emailService');
    await sendRegistrationConfirmation(user.email, user.name);
    // Notify admins
    const admins = await User.find({ status: 'Approved' }).select('email'); // simple: notify all approved users? Better: no admin role. Notify all? We'll notify all approved users as "admins"? 
    // Since no roles, notify all existing approved users
    for (const a of admins) {
      await sendAdminNewRegistration(a.email, user.name, user.email);
    }

    res.json({ message: 'Email verified. Your registration is pending admin approval.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.status !== 'Pending Verification') {
      return res.status(400).json({ message: 'Invalid request' });
    }
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.otp = hashedOtp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
    const { sendOTP } = require('../utils/emailService');
    await sendOTP(user.email, otp);
    res.json({ message: 'OTP resent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or username

  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    // Find user by username or email
    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };

    const user = await User.findOne(query).select('+password');

    if (user && (await user.matchPassword(password))) {
      if (user.status && user.status !== 'Approved') {
        return res.status(403).json({ message: `Account is ${user.status}. Please wait for approval.` });
      }
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh authentication token (sliding 10-minute session)
// @route   POST /api/auth/refresh
// @access  Private
const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
  verifyOtp,
  resendOtp,
};
