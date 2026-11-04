const Project = require('../models/Project');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const Task = require('../models/Task');

// Helper to log activities
const logActivity = async (projectId, userId, action, details = '') => {
  try {
    await ActivityLog.create({ project: projectId, user: userId, action, details });
  } catch (error) {
    console.error('Activity Log Error:', error.message);
  }
};

// Helper to send real-time notification
const sendNotification = async (req, { recipientId, senderId, type, projectId, taskId, message }) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      project: projectId,
      task: taskId,
      message,
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name username profilePicture')
      .populate('project', 'name')
      .populate('task', 'title');

    // Real-time socket delivery removed; clients poll REST endpoints for updates.
  } catch (error) {
    console.error('Notification creation error:', error.message);
  }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private (Admin or Project Manager)
const createProject = async (req, res) => {
  const { name, description } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const project = await Project.create({
      name,
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, projectRole: 'Project Manager' }],
    });

    await logActivity(project._id, req.user._id, 'Project Created', `Project "${name}" was created by ${req.user.name}`);

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper to extract user IDs from members array
const getMemberUserIds = (members) => members.map((m) => (m.user ? m.user._id || m.user : m));

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  try {
    let query = {};

    query['members.user'] = req.user._id;

    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }

    query.archived = req.query.archived === 'true';

    const projects = await Project.find(query)
      .populate('owner', 'name email username profilePicture')
      .populate('members.user', 'name email username profilePicture')
      .sort('-updatedAt')
      .lean();

    // Optimize task counts: single aggregation instead of N+1 queries
    const projectIds = projects.map((p) => p._id);
    const counts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$project', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c]));

    const projectsWithStats = projects.map((p) => {
      const c = countMap.get(String(p._id));
      return { ...p, totalTasks: c ? c.total : 0, completedTasks: c ? c.completed : 0 };
    });

    res.json(projectsWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single project details
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email username profilePicture')
      .populate('members.user', 'name email username profilePicture');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // ── Deduplicate members (fire-and-forget DB cleanup if duplicates exist) ──
    const seenUsers = new Set();
    const uniqueMembers = [];
    for (const m of project.members) {
      const uId = m.user ? (m.user._id || m.user).toString() : m.toString();
      if (!seenUsers.has(uId)) {
        seenUsers.add(uId);
        uniqueMembers.push(m);
      }
    }
    if (uniqueMembers.length !== project.members.length) {
      project.members = uniqueMembers;
      Project.findByIdAndUpdate(
        project._id,
        { $set: { members: uniqueMembers.map(m => ({ user: m.user._id || m.user, projectRole: m.projectRole })) } }
      ).exec();
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check if user is a member
    const isMember = project.members.some(
      (m) => m.user && (m.user._id || m.user).toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get project activity log (Paginated)
// @route   GET /api/projects/:id/activity
// @access  Private
const getProjectActivity = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isMember = project.members.some((m) => (m.user ? m.user.toString() : m.toString()) === req.user._id.toString());

    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    const total = await ActivityLog.countDocuments({ project: req.params.id });
    const activities = await ActivityLog.find({ project: req.params.id })
      .populate('user', 'name username profilePicture')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({ activities, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: count project members
const countVisibleMembers = (members) => (members || []).length;

// @desc    Update project details
// @route   PUT /api/projects/:id
// @access  Private (Admin or project owner)
const updateProject = async (req, res) => {
  const { name, description, archived } = req.body;

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ message: 'Access denied. Only project owners can edit project settings.' });
    }

    project.name = name || project.name;
    project.description = description !== undefined ? description : project.description;

    if (archived !== undefined) {
      project.archived = archived;
      await logActivity(project._id, req.user._id, archived ? 'Project Archived' : 'Project Unarchived',
        `Project "${project.name}" was ${archived ? 'archived' : 'restored'} by ${req.user.name}`);
    } else {
      await logActivity(project._id, req.user._id, 'Project Updated', `Project settings updated by ${req.user.name}`);
    }

    const updatedProject = await project.save();
    const populated = await Project.findById(updatedProject._id)
      .populate('owner', 'name email username profilePicture')
      .populate('members.user', 'name email username profilePicture');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private (Admin only)
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Notify members
    const memberIds = project.members.map((m) => m.user.toString());
    for (const memberId of memberIds) {
      if (memberId !== req.user._id.toString()) {
        await sendNotification(req, {
          recipientId: memberId,
          senderId: req.user._id,
          type: 'project_added',
          message: `Project "${project.name}" has been deleted.`,
        });
      }
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
// @access  Private (Admin, project owner, or assigned Project Manager member)
const removeMember = async (req, res) => {
  const { userId } = req.params;

  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const requesterId = req.user._id.toString();

    const isProjectOwner = project.owner.toString() === requesterId;
    const isMember = project.members.some((m) => m.user.toString() === requesterId);

    if (!isProjectOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this project.' });
    }

    // Cannot remove self
    if (userId === requesterId) {
      return res.status(403).json({ message: 'You cannot remove yourself from the project.' });
    }

    // Cannot remove the project owner
    if (project.owner.toString() === userId) {
      return res.status(400).json({ message: 'Cannot remove the project owner.' });
    }

    // Look up the member being removed
    const memberToRemove = project.members.find((m) => m.user.toString() === userId);
    if (!memberToRemove) {
      return res.status(400).json({ message: 'User is not a member of this project.' });
    }

    const targetUser = await User.findById(userId);

    project.members = project.members.filter((m) => m.user.toString() !== userId);
    await project.save();

    await logActivity(project._id, req.user._id, 'Member Removed',
      `${targetUser ? targetUser.name : 'Unknown'} was removed from the project by ${req.user.name}`);

    if (targetUser) {
      await sendNotification(req, {
        recipientId: userId,
        senderId: req.user._id,
        type: 'project_added',
        message: `You were removed from project "${project.name}" by ${req.user.name}`,
      });
    }

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email username profilePicture')
      .populate('members.user', 'name email username profilePicture');

    res.json(populatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  getProjectActivity,
  updateProject,
  deleteProject,
  removeMember,
  countVisibleMembers,
  logActivity,
  sendNotification,
};
