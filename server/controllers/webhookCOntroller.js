const crypto = require("crypto");
const Show = require("../models/Show");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const generateBookingCode = require("../utils/generateBookingCode");

const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const io = req.app.get("io");

    if (event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) return res.status(404).json({ message: "Payment record not found" });

      if (payment.status === "paid") {
        return res.status(200).json({ message: "Already processed" });
      }

      const show = await Show.findById(payment.show);
      const alreadyBooked = payment.seats.some((seatId) => {
        const seat = show.seats.find((s) => s.seatId === seatId);
        return !seat || seat.status === "booked";
      });

      if (alreadyBooked) {
        payment.status = "failed";
        await payment.save();

        await Show.updateOne(
          { _id: payment.show },
          {
            $set: {
              "seats.$[el].status": "available",
              "seats.$[el].lockedBy": null,
              "seats.$[el].lockedAt": null,
            },
          },
          { arrayFilters: [{ "el.seatId": { $in: payment.seats }, "el.status": { $ne: "booked" } }] }
        );
        io.to(`show:${payment.show}`).emit("seatsReleased", { seats: payment.seats });

        // TODO: trigger refund via razorpay.payments.refund()
        return res.status(200).json({ message: "Seats conflict, refund needed" });
      }

      await Show.updateOne(
        { _id: payment.show },
        {
          $set: {
            "seats.$[el].status": "booked",
            "seats.$[el].lockedBy": null,
            "seats.$[el].lockedAt": null,
          },
        },
        { arrayFilters: [{ "el.seatId": { $in: payment.seats } }] }
      );

      const booking = await Booking.create({
        user: payment.user,
        show: payment.show,
        seats: payment.seats,
        totalAmount: payment.amount,
        bookingCode: generateBookingCode(),
        status: "confirmed",
        paymentId: paymentEntity.id,
      });

      payment.status = "paid";
      payment.razorpayPaymentId = paymentEntity.id;
      payment.booking = booking._id;
      await payment.save();

      io.to(`show:${payment.show}`).emit("seatsBooked", { seats: payment.seats });
    }

    if (event === "payment.failed") {
      const orderId = req.body.payload.payment.entity.order_id;
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { status: "failed" },
        { new: true }
      );

      if (payment) {
        await Show.updateOne(
          { _id: payment.show },
          {
            $set: {
              "seats.$[el].status": "available",
              "seats.$[el].lockedBy": null,
              "seats.$[el].lockedAt": null,
            },
          },
          { arrayFilters: [{ "el.seatId": { $in: payment.seats } }] }
        );
        io.to(`show:${payment.show}`).emit("seatsReleased", { seats: payment.seats });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

module.exports = { razorpayWebhook };