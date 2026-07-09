const Notification = require('../models/Notification');

// @desc    Get user notifications (Paginated)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const total = await Notification.countDocuments({ recipient: req.user._id });
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name username profilePicture')
      .populate('project', 'name')
      .populate('task', 'title status')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.json({
      notifications,
      page,
      pages: Math.ceil(total / limit),
      total,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
const markAsRead = async (req, res) => {
  const { notificationId } = req.body;

  try {
    if (notificationId) {
      // Mark specific notification as read
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      if (notification.recipient.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      notification.read = true;
      await notification.save();
    } else {
      // Mark all user notifications as read
      await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { $set: { read: true } }
      );
    }

    const io = req.app.get('io');
    if (io) {
      const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
      io.to(req.user._id.toString()).emit('unread_count_update', { count: unreadCount });
    }

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};
