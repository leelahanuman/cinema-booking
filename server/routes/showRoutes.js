const express = require("express");
const router = express.Router();
const {
  createShow,
  getShows,
  getShowById,
} = require("../controllers/showController");
const { protect, admin } = require("../middleware/authMiddleware");

router.route("/").get(getShows).post(protect, admin, createShow);
router.route("/:id").get(getShowById);

module.exports = router;