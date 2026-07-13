import api from "./api";

export const getMovies = () => api.get("/movies").then((res) => res.data);

export const getMovieById = (id) => api.get(`/movies/${id}`).then((res) => res.data);

export const getShows = (params = {}) =>
  api.get("/shows", { params }).then((res) => res.data);

export const getShowById = (id) => api.get(`/shows/${id}`).then((res) => res.data);

export const getTheaters = (city) =>
  api.get("/theaters", { params: city ? { city } : {} }).then((res) => res.data);

export const createBooking = ({ showId, seats }) =>
  api.post("/bookings", { showId, seats }).then((res) => res.data);
 
export const getMyBookings = () => api.get("/bookings/my").then((res) => res.data);
 
export const cancelBooking = (id) =>
  api.put(`/bookings/${id}/cancel`).then((res) => res.data);
 

