const mongoose = require("mongoose");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const generateBookingCode = require("../utils/generateBookingCode");

// @desc   Create a booking for selected seats on a show
// @route  POST /api/bookings
// @access Private
const createBooking = async (req, res, next) => {
  try {
    const { showId, seats } = req.body;

    if (!showId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ message: "showId and seats[] are required" });
    }

    const show = await Show.findById(showId);
    if (!show) return res.status(404).json({ message: "Show not found" });

    // Ensure every requested seat is currently available or locked by this user's session
    const unavailable = seats.filter((seatId) => {
      const seat = show.seats.find((s) => s.seatId === seatId);
      return !seat || seat.status === "booked";
    });

    if (unavailable.length > 0) {
      return res.status(409).json({
        message: `These seats are no longer available: ${unavailable.join(", ")}`,
      });
    }

    // Mark seats as booked
    show.seats.forEach((seat) => {
      if (seats.includes(seat.seatId)) {
        seat.status = "booked";
        seat.lockedBy = null;
        seat.lockedAt = null;
      }
    });
    await show.save();

    const booking = await Booking.create({
      user: req.user._id,
      show: showId,
      seats,
      totalAmount: seats.length * show.price,
      bookingCode: generateBookingCode(),
    });

    const populated = await booking.populate({
      path: "show",
      populate: [{ path: "movie" }, { path: "theater" }],
    });

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc   Get bookings for logged-in user
// @route  GET /api/bookings/my
// @access Private
const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate({ path: "show", populate: [{ path: "movie" }, { path: "theater" }] })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

// @desc   Cancel a booking and free the seats
// @route  PUT /api/bookings/:id/cancel
// @access Private
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking already cancelled" });
    }

    booking.status = "cancelled";
    await booking.save();

    const show = await Show.findById(booking.show);
    if (show) {
      show.seats.forEach((seat) => {
        if (booking.seats.includes(seat.seatId)) {
          seat.status = "available";
        }
      });
      await show.save();
    }

    res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    next(error);
  }
};

module.exports = { createBooking, getMyBookings, cancelBooking };