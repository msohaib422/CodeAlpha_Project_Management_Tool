const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all notification routes

router.route('/')
  .get(getNotifications);

router.route('/read')
  .put(markAsRead);

module.exports = router;
