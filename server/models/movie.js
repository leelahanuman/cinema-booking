const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    language: { type: String, required: true },
    genre: [{ type: String }],
    duration: { type: Number, required: true }, // minutes
    releaseDate: { type: Date, required: true },
    posterUrl: { type: String, default: "" },
    rating: { type: Number, default: 0, min: 0, max: 10 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Movie", movieSchema);