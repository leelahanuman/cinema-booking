const Show = require("../models/Show");
const Theater = require("../models/Theater");

const rowLetters = "ABCDEFGHIJ";

const buildSeatMap = (rows, seatsPerRow) => {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    for (let s = 1; s <= seatsPerRow; s++) {
      seats.push({ seatId: `${rowLetters[r]}${s}`, status: "available" });
    }
  }
  return seats;
};

// @desc   Create a show (auto-builds seat layout from theater config)
// @route  POST /api/shows
// @access Private/Admin
const createShow = async (req, res, next) => {
  try {
    const { movie, theater, date, time, price } = req.body;

    const theaterDoc = await Theater.findById(theater);
    if (!theaterDoc) return res.status(404).json({ message: "Theater not found" });

    const seats = buildSeatMap(theaterDoc.rows, theaterDoc.seatsPerRow);

    const show = await Show.create({ movie, theater, date, time, price, seats });
    res.status(201).json(show);
  } catch (error) {
    next(error);
  }
};

// @desc   Get shows filtered by movie, city, date
// @route  GET /api/shows?movie=&city=&date=
// @access Public
const getShows = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.movie) filter.movie = req.query.movie;
    if (req.query.date) filter.date = req.query.date;

    let query = Show.find(filter).populate("movie").populate("theater");

    const shows = await query;

    const filtered = req.query.city
      ? shows.filter((s) => s.theater && s.theater.city === req.query.city)
      : shows;

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};

// @desc   Get a single show with live seat map
// @route  GET /api/shows/:id
// @access Public
const getShowById = async (req, res, next) => {
  try {
    const show = await Show.findById(req.params.id).populate("movie").populate("theater");
    if (!show) return res.status(404).json({ message: "Show not found" });
    res.json(show);
  } catch (error) {
    next(error);
  }
};

module.exports = { createShow, getShows, getShowById };