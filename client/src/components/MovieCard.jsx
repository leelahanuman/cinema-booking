import { Link } from "react-router-dom";

const MovieCard = ({ movie }) => {
  return (
    <Link to={`/movies/${movie._id}`} className="movie-card">
      <div className="movie-poster">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title} />
        ) : (
          <div className="movie-poster-placeholder">{movie.title[0]}</div>
        )}
      </div>
      <div className="movie-info">
        <h3>{movie.title}</h3>
        <p className="movie-meta">
          {movie.language} · {movie.duration} min
        </p>
        <p className="movie-genre">{movie.genre?.join(", ")}</p>
        <span className="movie-rating">⭐ {movie.rating?.toFixed(1) ?? "N/A"}</span>
      </div>
    </Link>
  );
};

export default MovieCard;