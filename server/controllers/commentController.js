const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { logActivity, sendNotification } = require('./projectController');

// @desc    Create a comment
// @route   POST /api/comments
// @access  Private
const createComment = async (req, res) => {
  const { taskId, message } = req.body;

  try {
    if (!taskId || !message) {
      return res.status(400).json({ message: 'Task ID and message are required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check membership — project.members is [{user, projectRole}], not plain IDs
    const isMember =
      req.user.role === 'Admin' ||
      project.members.some((m) => String(m.user) === String(req.user._id));
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comment = await Comment.create({
      task: taskId,
      author: req.user._id,
      message,
    });

    // Populate author
    const populatedComment = await Comment.findById(comment._id).populate(
      'author',
      'name username email profilePicture'
    );

    // Log project activity
    await logActivity(
      project._id,
      req.user._id,
      'Comment Added',
      `Comment added to task "${task.title}" by ${req.user.name}`
    );

    // Notify task assignee (if any and not the current user commenting)
    const notifyUsers = new Set();
    if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      notifyUsers.add(task.assignedTo.toString());
    }
    // Notify task creator (if not current user commenting)
    if (task.createdBy.toString() !== req.user._id.toString()) {
      notifyUsers.add(task.createdBy.toString());
    }

    for (const recipientId of notifyUsers) {
      await sendNotification(req, {
        recipientId,
        senderId: req.user._id,
        type: 'comment_added',
        projectId: project._id,
        taskId: task._id,
        message: `${req.user.name} commented on task "${task.title}": "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`,
      });
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get comments for a task
// @route   GET /api/comments
// @access  Private
const getComments = async (req, res) => {
  const { taskId } = req.query;

  try {
    if (!taskId) {
      return res.status(400).json({ message: 'taskId is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check membership — project.members is [{user, projectRole}], not plain IDs
    const isMember =
      req.user.role === 'Admin' ||
      project.members.some(
        (m) => String(m.user) === String(req.user._id)
      );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const comments = await Comment.find({ task: taskId })
      .populate('author', 'name username email profilePicture')
      .sort('createdAt'); // Ascending order for chat-like thread

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private
const updateComment = async (req, res) => {
  const { message } = req.body;

  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Author verification
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only edit your own comments.' });
    }

    comment.message = message || comment.message;
    const updated = await comment.save();

    const populated = await Comment.findById(updated._id).populate(
      'author',
      'name username email profilePicture'
    );

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Author verification
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own comments.' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Comment removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createComment,
  getComments,
  updateComment,
  deleteComment,
};
