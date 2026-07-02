const Theater = require("../models/Theater");

// @desc   Get all theaters (optionally filter by city)
// @route  GET /api/theaters
// @access Public
const getTheaters = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.city) filter.city = req.query.city;
    const theaters = await Theater.find(filter);
    res.json(theaters);
  } catch (error) {
    next(error);
  }
};

// @desc   Create a theater
// @route  POST /api/theaters
// @access Private/Admin
const createTheater = async (req, res, next) => {
  try {
    const theater = await Theater.create(req.body);
    res.status(201).json(theater);
  } catch (error) {
    next(error);
  }
};

// @desc   Update a theater
// @route  PUT /api/theaters/:id
// @access Private/Admin
const updateTheater = async (req, res, next) => {
  try {
    const theater = await Theater.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!theater) return res.status(404).json({ message: "Theater not found" });
    res.json(theater);
  } catch (error) {
    next(error);
  }
};

// @desc   Delete a theater
// @route  DELETE /api/theaters/:id
// @access Private/Admin
const deleteTheater = async (req, res, next) => {
  try {
    const theater = await Theater.findByIdAndDelete(req.params.id);
    if (!theater) return res.status(404).json({ message: "Theater not found" });
    res.json({ message: "Theater removed" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTheaters, createTheater, updateTheater, deleteTheater };