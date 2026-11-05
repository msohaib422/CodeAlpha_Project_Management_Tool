const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
  }
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// Wrapper that converts multer errors (file type/size) into 400 responses.
upload.singleWithError = (req, res, next) => {
  upload.single('profilePicture')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Profile image must be 5 MB or smaller'
          : err.message || 'Invalid upload';
      return res.status(400).json({ message });
    }
    next();
  });
};

module.exports = upload;