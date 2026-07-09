const Task = require('../models/Task');
const Project = require('../models/Project');
const { logActivity, sendNotification } = require('./projectController');

// Helper to determine due date query
const getDueDateQuery = (filter) => {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  if (filter === 'overdue') {
    return { $lt: startOfDay };
  } else if (filter === 'today') {
    return { $gte: startOfDay, $lte: endOfDay };
  } else if (filter === 'this_week') {
    const endOfWeek = new Date(now.setDate(now.getDate() + (6 - now.getDay())));
    endOfWeek.setHours(23, 59, 59, 999);
    return { $gte: startOfDay, $lte: endOfWeek };
  }
  return null;
};

/**
 * Helper: Check if the current user is the Project Manager of a specific project.
 * A user qualifies as PM if they are:
 *   1. The project owner (Admin who created it), OR
 *   2. A member whose projectRole is exactly 'Project Manager' (invited by Admin).
 *
 * NOTE: project.members[].user is an UNpopulated ObjectId here.
 * Use String() directly to avoid any (._id || self) pattern ambiguity.
 */
const isProjectManager = (project, userId) => {
  const userIdStr = String(userId);

  // Check 1: Is the user the project owner?
  if (String(project.owner) === userIdStr) return true;

  // Check 2: Is the user a member whose projectRole is 'Project Manager'?
  const pmMember = project.members.find(
    (m) => String(m.user) === userIdStr && m.projectRole === 'Project Manager'
  );
  return Boolean(pmMember);
};

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private — Admin or assigned Project Manager only
const createTask = async (req, res) => {
  const { title, description, priority, status, dueDate, projectId, assignedTo, tags } = req.body;

  try {
    if (!title || !projectId) {
      return res.status(400).json({ message: 'Title and projectId are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only the project's assigned PM (owner) can create tasks
    const isPM = isProjectManager(project, req.user._id);

    if (!isPM) {
      return res.status(403).json({
        message: 'Only the assigned Project Manager can create tasks',
      });
    }

    const task = await Task.create({
      title,
      description,
      priority,
      status,
      dueDate: dueDate || null,
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      tags: tags || [],
    });

    await logActivity(
      projectId,
      req.user._id,
      'Task Created',
      `Task "${title}" was created by ${req.user.name}`
    );

    // Send notification to assignee
    if (assignedTo && assignedTo.toString() !== req.user._id.toString()) {
      await sendNotification(req, {
        recipientId: assignedTo,
        senderId: req.user._id,
        type: 'task_assigned',
        projectId,
        taskId: task._id,
        message: `Task "${title}" has been assigned to you by ${req.user.name}`,
      });
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name username email profilePicture role')
      .populate('createdBy', 'name username email profilePicture');

    // Emit real-time task_created event so the assignee's and PM's dashboard refreshes
    const io = req.app.get('io');
    if (io) {
      const recipients = new Set();
      if (populatedTask.assignedTo) recipients.add(populatedTask.assignedTo._id.toString());
      if (populatedTask.createdBy) recipients.add(populatedTask.createdBy._id.toString());
      if (project.owner) recipients.add(project.owner.toString());
      if (project.members) {
        project.members.forEach(m => {
          if (m.projectRole === 'Project Manager') recipients.add(m.user.toString());
        });
      }
      recipients.forEach((uid) => io.to(uid).emit('task_created', populatedTask));
    }

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all tasks for a project (Filtered & Paginated)
// @route   GET /api/tasks
// @access  Private — any project member
const getTasks = async (req, res) => {
  const { projectId, status, priority, assignedTo, search, dueDate, page = 1, limit = 100 } = req.query;

  try {
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Admin sees all; members must be in the project
    const isAdmin = req.user.role === 'Admin';
    const isMember = project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isAdmin && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filterQuery = { project: projectId };

    if (status) filterQuery.status = status;
    if (priority) filterQuery.priority = priority;
    if (assignedTo) filterQuery.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;

    if (search) {
      filterQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (dueDate) {
      const dateQuery = getDueDateQuery(dueDate);
      if (dateQuery) filterQuery.dueDate = dateQuery;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(filterQuery);
    const tasks = await Task.find(filterQuery)
      .populate('assignedTo', 'name username email profilePicture role')
      .populate('createdBy', 'name username email profilePicture')
      .sort('dueDate')
      .skip(skip)
      .limit(limitNum);

    res.json({
      tasks,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private — Admin or assigned PM for full updates. Regular members: read-only (403).
const updateTask = async (req, res) => {
  const { title, description, priority, status, dueDate, assignedTo, tags } = req.body;

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Associated project not found' });
    }

    const isPM = isProjectManager(project, req.user._id);
    const isAssignee = task.assignedTo && task.assignedTo.toString() === req.user._id.toString();
    const isMember = project.members.some(
      (m) => m.user && (m.user._id || m.user).toString() === req.user._id.toString()
    );

    if (!isPM) {
      if (isMember && isAssignee) {
        const allowedFields = ['status'];
        const requestFields = Object.keys(req.body);
        const isOnlyStatus = requestFields.every((field) => allowedFields.includes(field));

        if (!isOnlyStatus) {
          return res.status(403).json({
            message: 'Normal members can only update the status of tasks assigned to themselves.',
          });
        }
      } else {
        return res.status(403).json({
          message: 'Only the assigned Project Manager can update tasks',
        });
      }
    }

    const oldStatus = task.status;
    const oldAssignee = task.assignedTo;

    task.title = title || task.title;
    task.description = description !== undefined ? description : task.description;
    task.priority = priority || task.priority;
    task.status = status || task.status;
    task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;
    task.assignedTo = assignedTo !== undefined ? (assignedTo === 'unassigned' ? null : assignedTo) : task.assignedTo;
    task.tags = tags || task.tags;

    const updatedTask = await task.save();
    const projectLogId = project._id;

    if (oldStatus !== updatedTask.status) {
      await logActivity(
        projectLogId,
        req.user._id,
        'Task Status Changed',
        `Task "${updatedTask.title}" status changed from "${oldStatus}" to "${updatedTask.status}"`
      );

      const notifyUsers = new Set();
      if (updatedTask.assignedTo && updatedTask.assignedTo.toString() !== req.user._id.toString()) {
        notifyUsers.add(updatedTask.assignedTo.toString());
      }
      if (updatedTask.createdBy.toString() !== req.user._id.toString()) {
        notifyUsers.add(updatedTask.createdBy.toString());
      }

      for (const userId of notifyUsers) {
        await sendNotification(req, {
          recipientId: userId,
          senderId: req.user._id,
          type: 'status_changed',
          projectId: project._id,
          taskId: updatedTask._id,
          message: `Task "${updatedTask.title}" status was changed to "${updatedTask.status}" by ${req.user.name}`,
        });
      }
    } else {
      await logActivity(
        projectLogId,
        req.user._id,
        'Task Updated',
        `Task "${updatedTask.title}" was updated by ${req.user.name}`
      );
    }

    // Notify on reassignment
    const oldAssigneeStr = oldAssignee ? oldAssignee.toString() : null;
    const newAssigneeStr = updatedTask.assignedTo ? updatedTask.assignedTo.toString() : null;

    if (oldAssigneeStr !== newAssigneeStr && newAssigneeStr && newAssigneeStr !== req.user._id.toString()) {
      await sendNotification(req, {
        recipientId: newAssigneeStr,
        senderId: req.user._id,
        type: 'task_assigned',
        projectId: project._id,
        taskId: updatedTask._id,
        message: `Task "${updatedTask.title}" has been assigned to you by ${req.user.name}`,
      });
    }

    const populatedTask = await Task.findById(updatedTask._id)
      .populate('assignedTo', 'name username email profilePicture role')
      .populate('createdBy', 'name username email profilePicture');

    // Emit real-time task_updated event so dashboards refresh immediately
    const io = req.app.get('io');
    if (io) {
      const recipients = new Set();
      if (populatedTask.assignedTo) recipients.add(populatedTask.assignedTo._id.toString());
      if (populatedTask.createdBy) recipients.add(populatedTask.createdBy._id.toString());
      if (project.owner) recipients.add(project.owner.toString());
      if (project.members) {
        project.members.forEach(m => {
          if (m.projectRole === 'Project Manager') recipients.add(m.user.toString());
        });
      }
      recipients.forEach((uid) => io.to(uid).emit('task_updated', populatedTask));
    }

    res.json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private — Admin or assigned PM only
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ message: 'Associated project not found' });
    }

    const isPM = isProjectManager(project, req.user._id);

    if (!isPM) {
      return res.status(403).json({
        message: 'Only the assigned Project Manager can delete tasks',
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    await logActivity(
      project._id,
      req.user._id,
      'Task Deleted',
      `Task "${task.title}" was deleted by ${req.user.name}`
    );

    if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      await sendNotification(req, {
        recipientId: task.assignedTo,
        senderId: req.user._id,
        type: 'task_assigned',
        projectId: project._id,
        message: `Task "${task.title}" assigned to you was deleted by ${req.user.name}`,
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
};
