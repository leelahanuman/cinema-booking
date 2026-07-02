import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMovieById, getShows } from "../services/movieService";

const nextSevenDays = () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(nextSevenDays()[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMovieById(id).then(setMovie);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    getShows({ movie: id, date: selectedDate })
      .then(setShows)
      .finally(() => setLoading(false));
  }, [id, selectedDate]);

  const groupedByTheater = shows.reduce((acc, show) => {
    const key = show.theater?._id || "unknown";
    if (!acc[key]) acc[key] = { theater: show.theater, times: [] };
    acc[key].times.push(show);
    return acc;
  }, {});

  if (!movie) return <p className="page-loading">Loading...</p>;

  return (
    <div className="page">
      <div className="movie-details-header">
        {movie.posterUrl && <img src={movie.posterUrl} alt={movie.title} />}
        <div>
          <h1>{movie.title}</h1>
          <p className="movie-meta">
            {movie.language} · {movie.duration} min · {movie.genre?.join(", ")}
          </p>
          <p>{movie.description}</p>
        </div>
      </div>

      <h2>Select Date</h2>
      <div className="date-picker">
        {nextSevenDays().map((date) => (
          <button
            key={date}
            className={date === selectedDate ? "date-btn active" : "date-btn"}
            onClick={() => setSelectedDate(date)}
          >
            {new Date(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
          </button>
        ))}
      </div>

      <h2>Showtimes</h2>
      {loading ? (
        <p>Loading showtimes...</p>
      ) : Object.keys(groupedByTheater).length === 0 ? (
        <p>No shows scheduled for this date.</p>
      ) : (
        Object.values(groupedByTheater).map(({ theater, times }) => (
          <div key={theater?._id} className="theater-block">
            <h3>{theater?.name}</h3>
            <p className="movie-meta">{theater?.address}</p>
            <div className="show-times">
              {times.map((show) => (
                <button
                  key={show._id}
                  className="showtime-btn"
                  onClick={() => navigate(`/shows/${show._id}/seats`)}
                >
                  {show.time}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MovieDetails;