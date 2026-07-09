const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  getProjectActivity,
  updateProject,
  deleteProject,
  removeMember,
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('Admin'), createProject);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(authorize('Admin'), deleteProject);

router.get('/:id/activity', getProjectActivity);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
