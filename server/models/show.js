const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    seatId: { type: String, required: true }, // e.g. "A1"
    status: { type: String, enum: ["available", "locked", "booked"], default: "available" },
    lockedBy: { type: String, default: null }, // socket id holding temp lock
    lockedAt: { type: Date, default: null },
  },
  { _id: false }
);

const showSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    theater: { type: mongoose.Schema.Types.ObjectId, ref: "Theater", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
    price: { type: Number, required: true, default: 200 },
    seats: [seatSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Show", showSchema);