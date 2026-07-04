import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyBookings } from "../services/bookingService";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await getMyBookings();
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.status === 401
              ? "Please log in to see your bookings"
              : err?.response?.data?.message || "Could not load your bookings"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d18] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading your bookings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0d18] text-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-400 text-center">{error}</p>
        <Link to="/login" className="text-sm text-yellow-400 underline underline-offset-2">
          Go to login
        </Link>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0d18] text-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-400">You don't have any bookings yet.</p>
        <Link to="/" className="text-sm text-yellow-400 underline underline-offset-2">
          Browse movies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2036_0%,_#0a0d18_60%)] text-white px-4 py-8">
      <h1 className="text-xl font-semibold text-center mb-6">My Bookings</h1>

      <div className="max-w-md mx-auto space-y-4">
        {bookings.map((booking) => (
          <BookingRow key={booking._id} booking={booking} />
        ))}
      </div>
    </div>
  );
}

function BookingRow({ booking }) {
  const show = booking.show || {};
  const movie = show.movie || {};
  const theater = show.theater || {};
  const isCancelled = booking.status === "cancelled";

  return (
    <Link
      to={`/bookings/${booking._id}`}
      state={{ booking }}
      className="block bg-white/[0.04] rounded-xl px-5 py-4 hover:bg-white/[0.07] transition"
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-medium">{movie.title || "Movie"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {theater.name}
            {show.date && show.time ? ` • ${formatShowDateTime(show.date, show.time)}` : ""}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Seats: {(booking.seats || []).join(", ")}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-semibold">₹{booking.totalAmount}</p>
          <p
            className={`text-[11px] mt-1 font-medium ${
              isCancelled ? "text-red-400" : "text-green-400"
            }`}
          >
            {isCancelled ? "Cancelled" : "Confirmed"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function formatShowDateTime(date, time) {
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}