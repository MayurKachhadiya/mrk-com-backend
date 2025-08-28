const express = require("express");
const {
  userSignUp,
  userSignIn,
  userUpdate,
} = require("../controllers/userController");
const router = express.Router();
const imageUpload = require("../middleware/imageUpload");
const auth = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

router.post("/signup", upload.single("profileImages"), userSignUp);
router.post("/signIn", userSignIn);
router.post("/update/:uid", auth, upload.single("profileImages"), userUpdate);
module.exports = router;
