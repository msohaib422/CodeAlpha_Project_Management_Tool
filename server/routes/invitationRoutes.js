const express = require('express');
const router = express.Router();
const {
  inviteUser,
  getMyInvitations,
  getProjectInvitations,
  respondToInvitation,
  cancelInvitation,
} = require('../controllers/invitationController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Send invitation (Admin or Project Manager)
router.post('/', protect, authorize('Admin', 'Project Manager'), inviteUser);

// Get MY pending invitations (any logged-in user)
router.get('/my', protect, getMyInvitations);

// Get invitations for a specific project
router.get('/project/:projectId', protect, getProjectInvitations);

// Respond to an invitation (accept/reject)
router.put('/:id/respond', protect, respondToInvitation);

// Cancel invitation
router.delete('/:id', protect, cancelInvitation);

module.exports = router;
