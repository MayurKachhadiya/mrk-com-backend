const express = require("express");
const { reviewAdd, reviewUpdate, reviewDelete } = require("../controllers/reviewController");
const auth = require("../middleware/auth");
const router = express.Router();

router.post("/add", auth, reviewAdd);
router.post("/update/:id", auth, reviewUpdate);
router.delete("/delete/:id", auth, reviewDelete);

module.exports = router;
