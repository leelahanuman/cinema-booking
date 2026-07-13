import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { getMyBookings, cancelBooking } from "../services/bookingService";

// There is no GET /api/bookings/:id route on the server — only /api/bookings/my
// and PUT /api/bookings/:id/cancel. SeatSelection.jsx already passes the freshly
// created booking via navigate(..., { state: { booking } }), so we use that first.
// If the page is opened directly (refresh, shared link, no state), we fall back
// to fetching the user's bookings and finding this one by id.
export default function BookingConfirmation() {
  const { id } = useParams();
  const location = useLocation();

  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!location.state?.booking);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (booking) return; // already have it from navigation state

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const all = await getMyBookings();
        const found = all.find((b) => b._id === id);
        if (!cancelled) {
          if (found) setBooking(found);
          else setError("Booking not found");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Could not load this booking");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, booking]);

  const handleCancel = async () => {
    if (!booking || cancelling) return;
    const ok = window.confirm("Cancel this booking? This can't be undone.");
    if (!ok) return;

    setCancelling(true);
    setError("");
    try {
      const result = await cancelBooking(booking._id);
      setBooking((prev) => ({ ...prev, status: "cancelled", ...result.booking }));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not cancel booking");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d18] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading your booking…</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#0a0d18] text-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-400 text-center">{error || "Booking not found"}</p>
        <Link
          to="/"
          className="text-sm text-yellow-400 underline underline-offset-2"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const show = booking.show || {};
  const movie = show.movie || {};
  const theater = show.theater || {};
  const isCancelled = booking.status === "cancelled";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2036_0%,_#0a0d18_60%)] text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Status banner */}
        <div
          className={`text-center py-2 rounded-t-2xl text-sm font-semibold ${
            isCancelled ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"
          }`}
        >
          {isCancelled ? "Booking Cancelled" : "Booking Confirmed"}
        </div>

        <div className="bg-white/[0.04] rounded-b-2xl px-6 py-6 space-y-5">

          {/* Movie */}
          <div className="text-center">
            <h1 className="text-xl font-semibold">{movie.title || "Movie"}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {theater.name}
              {show.date && show.time ? ` • ${formatShowDateTime(show.date, show.time)}` : ""}
            </p>
          </div>

          <div className="border-t border-white/10" />

          {/* Booking code */}
          <div className="text-center">
            <p className="text-xs tracking-widest text-gray-500">BOOKING CODE</p>
            <p className="text-lg font-mono font-semibold tracking-wider mt-1">
              {booking.bookingCode}
            </p>
          </div>

          {/* Seats */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Seats</span>
            <span className="font-medium">{(booking.seats || []).join(", ")}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total paid</span>
            <span className="font-semibold text-lg">₹{booking.totalAmount}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <span className={isCancelled ? "text-red-400" : "text-green-400"}>
              {isCancelled ? "Cancelled" : "Confirmed"}
            </span>
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <div className="flex flex-col gap-3 pt-2">
            <Link
              to="/"
              className="w-full text-center bg-yellow-400 text-black font-semibold py-3 rounded-xl"
            >
              Back to Home
            </Link>

            {!isCancelled && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full text-center text-sm text-gray-400 py-2 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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