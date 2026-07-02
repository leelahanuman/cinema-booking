const mongoose = require("mongoose");

const theaterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    totalSeats: { type: Number, required: true, default: 60 },
    rows: { type: Number, required: true, default: 6 }, // A-F
    seatsPerRow: { type: Number, required: true, default: 10 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Theater", theaterSchema);