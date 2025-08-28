const express = require("express");
const {
  userSignUp,
  userSignIn,
  userUpdate,
} = require("../controllers/userController");
const router = express.Router();
const imageUpload = require("../middleware/imageUpload");
const auth = require("../middleware/auth");

router.post("/signup", imageUpload.single("profileImages"), userSignUp);
router.post("/signIn", userSignIn);
router.post(
  "/update/:uid",
  auth,
  imageUpload.single("profileImages"),
  userUpdate
);
module.exports = router;
