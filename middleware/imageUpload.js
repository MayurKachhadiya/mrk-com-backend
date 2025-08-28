const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname),
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValid = /\.(jpg|jpeg|png)$/.test(ext);
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"));
  }
};

const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // optional: 5MB limit
});

module.exports = imageUpload;