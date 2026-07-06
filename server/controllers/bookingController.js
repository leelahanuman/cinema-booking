const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const generateBookingCode = require("../utils/generateBookingCode");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const SEAT_LOCK_MINUTES = 8;

// @desc   Lock seats atomically + create Razorpay order
// @route  POST /api/bookings/create-order
// @access Private
const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { showId, seats } = req.body;
    if (!showId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ message: "showId and seats[] are required" });
    }

    const now = new Date();
    const lockExpiry = new Date(now.getTime() - SEAT_LOCK_MINUTES * 60 * 1000);
    let show;

    // Atomic seat lock — race condition ni MongoDB query filter tho handle chestunnam,
    // JS loop tho kaadu (ide industry standard: DB-level atomicity)
    await session.withTransaction(async () => {
      show = await Show.findOne({
        _id: showId,
        seats: {
          $not: {
            $elemMatch: {
              seatId: { $in: seats },
              $or: [
                { status: "booked" },
                {
                  status: "locked",
                  lockedBy: { $ne: req.user._id },
                  lockedAt: { $gt: lockExpiry },
                },
              ],
            },
          },
        },
      }).session(session);

      if (!show) {
        throw { statusCode: 409, message: "Some seats are no longer available" };
      }

      await Show.updateOne(
        { _id: showId },
        {
          $set: {
            "seats.$[el].status": "locked",
            "seats.$[el].lockedBy": req.user._id,
            "seats.$[el].lockedAt": now,
          },
        },
        { arrayFilters: [{ "el.seatId": { $in: seats } }], session }
      );
    });

    const freshShow = await Show.findById(showId);
    const totalAmount = seats.length * freshShow.price;

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    await Payment.create({
      user: req.user._id,
      show: showId,
      seats,
      amount: totalAmount,
      razorpayOrderId: order.id,
      status: "created",
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc   Client-side confirmation (fast UX feedback only — NOT the source of truth)
// @route  POST /api/bookings/verify-payment
// @access Private
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Signature mismatch" });
    }

    // Idi ikkada booking create cheyadu. Webhook ye adi chestundi.
    // Ikkada matrame "processing..." status ki poll cheyamani client ki cheptham.
    res.json({ success: true, message: "Payment received, confirming booking..." });
  } catch (error) {
    next(error);
  }
};

// @desc   Poll booking status by razorpay order id (frontend "confirming..." screen kosam)
// @route  GET /api/bookings/status/:orderId
// @access Private
const getBookingStatusByOrder = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ razorpayOrderId: req.params.orderId })
      .populate("booking");
    if (!payment) return res.status(404).json({ message: "Order not found" });

    res.json({
      status: payment.status, // created | paid | failed | refunded
      booking: payment.booking,
    });
  } catch (error) {
    next(error);
  }
};

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

    await Show.updateOne(
      { _id: booking.show },
      {
        $set: {
          "seats.$[el].status": "available",
          "seats.$[el].lockedBy": null,
          "seats.$[el].lockedAt": null,
        },
      },
      { arrayFilters: [{ "el.seatId": { $in: booking.seats } }] }
    );

    res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getBookingStatusByOrder,
  getMyBookings,
  cancelBooking,
};