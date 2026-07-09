const express = require('express');
const router = express.Router();
const { createComment, getComments, updateComment, deleteComment } = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all comment routes

router.route('/')
  .get(getComments)
  .post(createComment);

router.route('/:id')
  .put(updateComment)
  .delete(deleteComment);

module.exports = router;
