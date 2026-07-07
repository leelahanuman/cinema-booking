const razorpay = require("../config/razorpay");
const Show = require("../models/Show");
const Payment = require("../models/Payment");
const { SEAT_LOCK_TIMEOUT_MS } = require("../config/constants");

// @desc   Create a Razorpay order for selected seats
// @route  POST /api/payments/create-order
// @access Private
const createOrder = async (req, res, next) => {
  try {
    const { showId, seats } = req.body;

    if (!showId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ message: "showId and seats[] are required" });
    }

    const show = await Show.findById(showId);
    if (!show) return res.status(404).json({ message: "Show not found" });

    const userId = String(req.user._id);

    // Re-validate seats server-side — never trust client for availability or price
    const unavailable = seats.filter((seatId) => {
      const seat = show.seats.find((s) => s.seatId === seatId);
      if (!seat) return true;
      if (seat.status === "booked") return true;
      if (seat.status === "locked") {
        const isOwnLock = seat.lockedBy === userId;
        const lockExpired =
          seat.lockedAt && Date.now() - new Date(seat.lockedAt).getTime() > SEAT_LOCK_TIMEOUT_MS;
        if (!isOwnLock && !lockExpired) return true;
      }
      return false;
    });

    if (unavailable.length > 0) {
      return res.status(409).json({
        message: `These seats are no longer available: ${unavailable.join(", ")}`,
      });
    }

    // Hard-lock seats to this user for the duration of the payment attempt,
    // overriding any expired/own socket-based lock.
    show.seats.forEach((seat) => {
      if (seats.includes(seat.seatId)) {
        seat.status = "locked";
        seat.lockedBy = userId;
        seat.lockedAt = new Date();
      }
    });
    await show.save();

    req.app.get("io").to(`show:${showId}`).emit("seatLocked", { seatIds: seats, lockedBy: userId });

    const amount = seats.length * show.price; // server computes price, client can't tamper

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `show_${showId}_${Date.now()}`,
      notes: { showId, seats: seats.join(","), userId },
    });

    const payment = await Payment.create({
      user: req.user._id,
      show: showId,
      seats,
      amount,
      razorpayOrderId: order.id,
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentRecordId: payment._id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder };