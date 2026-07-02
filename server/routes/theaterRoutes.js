const express = require("express");
const router = express.Router();
const {
  getTheaters,
  createTheater,
  updateTheater,
  deleteTheater,
} = require("../controllers/theaterController");
const { protect, admin } = require("../middleware/authMiddleware");

router.route("/").get(getTheaters).post(protect, admin, createTheater);
router.route("/:id").put(protect, admin, updateTheater).delete(protect, admin, deleteTheater);

module.exports = router;