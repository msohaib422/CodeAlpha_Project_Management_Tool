const User = require('../models/User');
const Notification = require('../models/Notification');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');
const { sendOTP, sendPasswordResetEmail } = require('../utils/emailService');
const PasswordResetToken = require('../models/PasswordResetToken');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_SENDS = 5;
const MAX_OTP_ATTEMPTS = 5;

const EMAIL_REGEX = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

const generateSecureOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashOtp = (otp) =>
  crypto.createHash('sha256').update(`${otp}.${process.env.JWT_SECRET || ''}`).digest('hex');

const safeMessage = 'Registration failed. Please try again.';

// @desc    Register a new user (step 1: send OTP)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, username, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (username) {
      const usernameExists = await User.findOne({ username: String(username).toLowerCase() });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    const existing = await User.findOne({ email: normalizedEmail }).select(
      '+otp +otpExpires +otpSentAt +otpSendCount +otpAttempts'
    );

    if (existing && existing.status !== 'Pending Verification') {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    if (existing) {
      // Resend cooldown / abuse protection.
      if (existing.otpSentAt && Date.now() - new Date(existing.otpSentAt).getTime() < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ message: 'Please wait a moment before requesting another code.' });
      }
      if ((existing.otpSendCount || 0) >= MAX_OTP_SENDS) {
        return res.status(429).json({ message: 'Too many verification emails requested. Please try again later.' });
      }
    }

    // Snapshot previous OTP state (for rollback if delivery fails).
    const previousState = existing
      ? {
          otp: existing.otp,
          otpExpires: existing.otpExpires,
          otpSentAt: existing.otpSentAt,
          otpSendCount: existing.otpSendCount,
          otpAttempts: existing.otpAttempts,
        }
      : null;

    const otp = generateSecureOtp();
    const hashedOtp = hashOtp(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    const otpSentAt = new Date();

    // Persist the OTP first (so we can roll back on delivery failure).
    let user = existing;
    const isNew = !existing;
    try {
      if (isNew) {
        user = await User.create({
          name,
          username: username || undefined,
          email: normalizedEmail,
          password,
          status: 'Pending Verification',
          otp: hashedOtp,
          otpExpires,
          otpSentAt,
          otpSendCount: 1,
          otpAttempts: 0,
        });
      } else {
        user.otp = hashedOtp;
        user.otpExpires = otpExpires;
        user.otpSentAt = otpSentAt;
        user.otpSendCount = (existing.otpSendCount || 0) + 1;
        user.otpAttempts = 0;
        await user.save();
      }
    } catch (dbErr) {
      if (dbErr && dbErr.code === 11000) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }
      console.error('[register] db error:', dbErr.message);
      return res.status(500).json({ message: safeMessage });
    }

    // Now attempt delivery. On failure, roll back so the user can retry safely.
    try {
      await sendOTP(user.email, otp, name);
    } catch (emailErr) {
      console.error('[register] email delivery failed:', emailErr.message);
      try {
        if (isNew) {
          await User.deleteOne({ _id: user._id });
        } else {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                otp: previousState.otp,
                otpExpires: previousState.otpExpires,
                otpSentAt: previousState.otpSentAt,
                otpSendCount: previousState.otpSendCount,
                otpAttempts: previousState.otpAttempts,
              },
            }
          );
        }
      } catch (rollbackErr) {
        console.error('[register] rollback failed:', rollbackErr.message);
      }
      return res.status(502).json({
        message: 'We could not send the verification email. Please try again in a moment.',
      });
    }

    res.status(201).json({ message: 'OTP sent to your email. Please verify to continue registration.' });
  } catch (error) {
    console.error('[register]', error.message);
    if (error && error.code === 11000) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: safeMessage });
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

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ message: 'Please enter the 6-digit code' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpires +otpSentAt +otpSendCount +otpAttempts');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status !== 'Pending Verification') {
      return res.status(400).json({ message: 'Registration already processed' });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      // Invalidate expired code so it cannot be reused.
      user.otp = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }

    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      user.otp = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    const hashedOtp = hashOtp(otp);
    // Timing-safe comparison.
    let match = false;
    try {
      match = crypto.timingSafeEqual(Buffer.from(hashedOtp), Buffer.from(user.otp));
    } catch (e) {
      match = false;
    }

    if (!match) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Move to pending approval. Clear OTP to prevent reuse.
    user.status = 'Pending Approval';
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpSentAt = undefined;
    user.otpSendCount = 0;
    user.otpAttempts = 0;
    await user.save();

    // In-app notifications for admins (best-effort, non-blocking on failure).
    try {
      const admins = await User.find({ status: 'Approved' }).select('_id email name');
      const now = new Date();
      // Prevent duplicate notifications for the same registration.
      const existing = await Notification.find({ type: 'registration_request', relatedUser: user._id }).select('recipient');
      const existingRecipients = new Set(existing.map((n) => n.recipient.toString()));
      for (const admin of admins) {
        if (admin._id.toString() === user._id.toString()) continue;
        if (existingRecipients.has(admin._id.toString())) continue;
        try {
          await Notification.create({
            recipient: admin._id,
            sender: user._id,
            type: 'registration_request',
            relatedUser: user._id,
            message: `New registration: ${user.name} has verified his email and is waiting for approval.`,
            read: false,
          });
        } catch (e) {
          console.error('[verify-otp] in-app notification failed:', e.message);
        }
      }

      // Notification emails are best-effort: never fail verification because of email.
      const { sendRegistrationConfirmation, sendAdminNewRegistration } = require('../utils/emailService');
      try {
        await sendRegistrationConfirmation(user.email, user.name);
      } catch (e) {
        console.error('[verify-otp] confirmation email failed:', e.message);
      }
      // Cap admin notifications to avoid serverless timeouts; each is independently caught.
      for (const a of admins.slice(0, 10)) {
        try {
          await sendAdminNewRegistration(a.email, user.name, user.email, now, user._id);
        } catch (e) {
          console.error('[verify-otp] admin notification failed:', e.message);
        }
      }
    } catch (e) {
      console.error('[verify-otp] post-verification notification block failed:', e.message);
    }

    res.json({ message: 'Email verified. Your registration is pending admin approval.' });
  } catch (error) {
    console.error('[verify-otp]', error.message);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      '+otp +otpExpires +otpSentAt +otpSendCount +otpAttempts'
    );
    if (!user || user.status !== 'Pending Verification') {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (user.otpSentAt && Date.now() - new Date(user.otpSentAt).getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait a moment before requesting another code.' });
    }
    if ((user.otpSendCount || 0) >= MAX_OTP_SENDS) {
      return res.status(429).json({ message: 'Too many verification emails requested. Please try again later.' });
    }

    const previousState = {
      otp: user.otp,
      otpExpires: user.otpExpires,
      otpSentAt: user.otpSentAt,
      otpSendCount: user.otpSendCount,
      otpAttempts: user.otpAttempts,
    };

    const otp = generateSecureOtp();
    const hashedOtp = hashOtp(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    const otpSentAt = new Date();

    user.otp = hashedOtp;
    user.otpExpires = otpExpires;
    user.otpSentAt = otpSentAt;
    user.otpSendCount = (user.otpSendCount || 0) + 1;
    user.otpAttempts = 0;
    await user.save();

    try {
      await sendOTP(user.email, otp, user.name);
    } catch (emailErr) {
      console.error('[resend-otp] email delivery failed:', emailErr.message);
      try {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              otp: previousState.otp,
              otpExpires: previousState.otpExpires,
              otpSentAt: previousState.otpSentAt,
              otpSendCount: previousState.otpSendCount,
              otpAttempts: previousState.otpAttempts,
            },
          }
        );
      } catch (rollbackErr) {
        console.error('[resend-otp] rollback failed:', rollbackErr.message);
      }
      return res.status(502).json({
        message: 'We could not send the verification email. Please try again in a moment.',
      });
    }

    res.json({ message: 'OTP resent to your email.' });
  } catch (error) {
    console.error('[resend-otp]', error.message);
    res.status(500).json({ message: 'Failed to resend OTP. Please try again.' });
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
        token: generateToken(user._id, user.tokenVersion || 0),
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
      token: generateToken(user._id, user.tokenVersion || 0),
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

const forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = String(req.body && req.body.email ? req.body.email : '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    // Generic response to avoid account enumeration.
    const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

    if (!user) {
      return res.json(genericResponse);
    }

    // Rate limiting: max 3 reset requests per 15 minutes.
    const recentCount = await PasswordResetToken.countDocuments({
      user: user._id,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    if (recentCount >= 3) {
      return res.json(genericResponse);
    }

    // Invalidate previous outstanding tokens.
    await PasswordResetToken.updateMany(
      { user: user._id, used: false },
      { $set: { used: true, usedAt: new Date() } }
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const resetUrl = `${(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()}/reset-password?token=${rawToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailErr) {
      console.error('[forgot-password] email delivery failed:', emailErr.message);
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error('[forgot-password]', error.message);
    return res.status(500).json({ message: 'Failed to process request' });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const token = String(req.params.token || req.body && req.body.token || '').trim();
    if (!token) return res.status(400).json({ valid: false, message: 'Token is required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, used: false });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, message: 'Invalid or expired token' });
    }
    return res.json({ valid: true });
  } catch (error) {
    return res.status(500).json({ valid: false, message: 'Failed to validate token' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body && req.body.token ? req.body.token : '').trim();
    const password = String(req.body && req.body.password ? req.body.password : '');
    const confirmPassword = String(req.body && req.body.confirmPassword ? req.body.confirmPassword : '');

    if (!token) return res.status(400).json({ message: 'Token is required' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, used: false });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findById(record.user);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = password;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Mark token used and invalidate all other tokens for this user.
    record.used = true;
    record.usedAt = new Date();
    await record.save();
    await PasswordResetToken.updateMany(
      { user: user._id, _id: { $ne: record._id }, used: false },
      { $set: { used: true, usedAt: new Date() } }
    );

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('[reset-password]', error.message);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  refreshToken,
  verifyOtp,
  resendOtp,
  forgotPassword,
  validateResetToken,
  resetPassword,
};
