import { useEffect, useState } from "react";
import MovieCard from "../components/MovieCard";
import { getMovies } from "../services/movieService";

const Home = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMovies()
      .then(setMovies)
      .catch(() => setError("Could not load movies. Is the server running?"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="page-loading">Loading movies...</p>;
  if (error) return <p className="page-error">{error}</p>;

  return (
    <div className="page">
      <h1>Now Showing</h1>
      {movies.length === 0 ? (
        <p>No movies yet. Add some from the admin API.</p>
      ) : (
        <div className="movie-grid">
          {movies.map((movie) => (
            <MovieCard key={movie._id} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;