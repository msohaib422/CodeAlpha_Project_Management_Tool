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

    // Any project member can create tasks
    const isMember = project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
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

    notifyProjectMembers(project, 'created a task', title, req.user.name, `Priority: ${priority || 'medium'}`, req.user._id);

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
      .populate('assignedTo', 'name username email profilePicture')
      .populate('createdBy', 'name username email profilePicture');

    // Real-time socket delivery removed; clients poll REST endpoints for updates.

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

    const isMember = project.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
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
      .populate('assignedTo', 'name username email profilePicture')
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

    const isMember = project.members.some(
      (m) => m.user && (m.user._id || m.user).toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
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

    // Email all project members about this update
    const changeDetail = oldStatus !== updatedTask.status
      ? `Status changed from "${oldStatus}" to "${updatedTask.status}"`
      : 'Task details updated';
    notifyProjectMembers(project, 'updated a task', updatedTask.title, req.user.name, changeDetail, req.user._id);

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
      .populate('assignedTo', 'name username email profilePicture')
      .populate('createdBy', 'name username email profilePicture');

    // Real-time socket delivery removed; clients poll REST endpoints for updates.

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

    const isMember = project.members.some(
      (m) => m.user && (m.user._id || m.user).toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
    }

    await Task.findByIdAndDelete(req.params.id);

    await logActivity(
      project._id,
      req.user._id,
      'Task Deleted',
      `Task "${task.title}" was deleted by ${req.user.name}`
    );

    notifyProjectMembers(project, 'deleted a task', task.title, req.user.name, '', req.user._id);

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
