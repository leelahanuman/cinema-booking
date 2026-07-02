const express = require("express");
const router = express.Router();

const {
  createBooking,
  getMyBookings,
  cancelBooking,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/authMiddleware");

// Create a new booking
router.post("/", protect, createBooking);

// Get logged-in user's bookings
router.get("/my", protect, getMyBookings);

// Cancel a booking
router.put("/:id/cancel", protect, cancelBooking);

module.exports = router;