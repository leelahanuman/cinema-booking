const Movie = require("../models/Movie");

// @desc   Get all movies
// @route  GET /api/movies
// @access Public
const getMovies = async (req, res, next) => {
  try {
    const movies = await Movie.find().sort({ releaseDate: -1 });
    res.json(movies);
  } catch (error) {
    next(error);
  }
};

// @desc   Get single movie
// @route  GET /api/movies/:id
// @access Public
const getMovieById = async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    res.json(movie);
  } catch (error) {
    next(error);
  }
};

// @desc   Create a movie
// @route  POST /api/movies
// @access Private/Admin
const createMovie = async (req, res, next) => {
  try {
    const movie = await Movie.create(req.body);
    res.status(201).json(movie);
  } catch (error) {
    next(error);
  }
};

// @desc   Update a movie
// @route  PUT /api/movies/:id
// @access Private/Admin
const updateMovie = async (req, res, next) => {
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    res.json(movie);
  } catch (error) {
    next(error);
  }
};

// @desc   Delete a movie
// @route  DELETE /api/movies/:id
// @access Private/Admin
const deleteMovie = async (req, res, next) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    res.json({ message: "Movie removed" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMovies, getMovieById, createMovie, updateMovie, deleteMovie };