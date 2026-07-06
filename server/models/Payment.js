const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    show: { type: mongoose.Schema.Types.ObjectId, ref: "Show", required: true },
    seats: [{ type: String, required: true }],
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
    },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);