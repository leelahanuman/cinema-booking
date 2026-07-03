import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShowById, createBooking } from "../services/bookingService";
import { getSocket } from "../services/socketService";
import SeatCountModal from "../components/SeatCountModal";
// Matches server/models/Show.js seat sub-document: { seatId, row, number, category, status, lockedBy }
// status is one of "available" | "locked" | "booked" (server/socket/socketHandlers.js, server/controllers/bookingController.js)

const CATEGORY_LABEL = { premium: "Premium", classic: "Classic" };

const seatKey = (row, number) => `${row}${number}`;

export default function SeatSelection() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  // Seat Count Modal State
  const [showSeatModal, setShowSeatModal] = useState(true);
  const [seatCount, setSeatCount] = useState(1);
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [booking, setBooking] = useState(false);

  // ---- fetch show + open socket room ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getShowById(showId);
        if (!cancelled) setShow(data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || "Could not load this show");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    const socket = getSocket();
    socketRef.current = socket;
    socket.emit("joinShow", showId);

    // another user locked a seat -> reflect it live, unless it's a lock we hold ourselves
    const onSeatLocked = ({ seatId, lockedBy }) => {
      if (lockedBy === socket.id) return; // our own optimistic update already applied
      setShow((prev) => patchSeat(prev, seatId, { status: "locked", lockedBy }));
    };
    const onSeatUnlocked = ({ seatId }) => {
      setShow((prev) => patchSeat(prev, seatId, { status: "available", lockedBy: null }));
      setSelected((prev) => dropSeat(prev, seatId));
    };
    const onSeatsBooked = ({ seats }) => {
      setShow((prev) => {
        let next = prev;
        seats.forEach((seatId) => {
          next = patchSeat(next, seatId, { status: "booked", lockedBy: null });
        });
        return next;
      });
      setSelected((prev) => {
        let next = prev;
        seats.forEach((seatId) => (next = dropSeat(next, seatId)));
        return next;
      });
    };
    const onSeatUnavailable = ({ seatId }) => {
      // server rejected our lock attempt (already booked or locked by someone else)
      setSelected((prev) => dropSeat(prev, seatId));
      setError(`Seat ${seatId} was just taken. Pick another one.`);
    };
    const onSeatsReleased = async () => {
      // some socket disconnected and freed locks (server/socket/socketHandlers.js disconnect handler)
      try {
        const fresh = await getShowById(showId);
        if (!cancelled) setShow(fresh);
      } catch {
        /* ignore - next interaction will resync */
      }
    };

    socket.on("seatLocked", onSeatLocked);
    socket.on("seatUnlocked", onSeatUnlocked);
    socket.on("seatsBooked", onSeatsBooked);
    socket.on("seatUnavailable", onSeatUnavailable);
    socket.on("seatsReleased", onSeatsReleased);

    return () => {
      cancelled = true;
      socket.emit("leaveShow", showId);
      socket.off("seatLocked", onSeatLocked);
      socket.off("seatUnlocked", onSeatUnlocked);
      socket.off("seatsBooked", onSeatsBooked);
      socket.off("seatUnavailable", onSeatUnavailable);
      socket.off("seatsReleased", onSeatsReleased);
    };
  }, [showId]);

  // ---- derived data ----
  const rows = useMemo(() => groupByRow(show?.seats || []), [show]);

  const selectedSeats = useMemo(
    () => (show?.seats || []).filter((s) => selected.has(s.seatId)),
    [show, selected]
  );

  // NOTE: bookingController.createBooking currently bills seats.length * show.price
  // (server/controllers/bookingController.js) — it does not yet vary price by category.
  // This total mirrors that flat rate so what the user sees matches what gets charged.
  // If you want Premium/Classic priced differently, that needs a small backend change too.
  const total = selectedSeats.length * (show?.price || 0);

  // ---- interactions ----
  const toggleSeat = (seat) => {
    const socket = socketRef.current;
    if (!socket || !show) return;

    if (seat.status === "booked") return;
    if (seat.status === "locked" && seat.lockedBy !== socket.id) return; // someone else has it

    if (selected.has(seat.seatId)) {
      socket.emit("unlockSeat", { showId, seatId: seat.seatId });
      setSelected((prev) => dropSeat(prev, seat.seatId));
      setShow((prev) => patchSeat(prev, seat.seatId, { status: "available", lockedBy: null }));
    } else {
      socket.emit("lockSeat", { showId, seatId: seat.seatId });
      // optimistic: assume the lock succeeds; seatUnavailable will correct us if not
      setSelected((prev) => new Set(prev).add(seat.seatId));
      setShow((prev) =>
        patchSeat(prev, seat.seatId, { status: "locked", lockedBy: socketRef.current.id })
      );
    }
  };

  const confirmBooking = async () => {
    if (selectedSeats.length === 0 || booking) return;
    setBooking(true);
    setError("");
    try {
      const result = await createBooking({
        showId,
        seats: selectedSeats.map((s) => s.seatId),
      });
      socketRef.current.emit("seatBooked", {
        showId,
        seats: selectedSeats.map((s) => s.seatId),
      });
      navigate(`/bookings/${result._id}`, { state: { booking: result } });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not confirm booking — please retry");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-neutral-400">Loading seats…</div>;
  if (!show) return <div className="p-8 text-center text-red-400">{error || "Show not found"}</div>;

  return (
    <>
  <div className="min-h-screen bg-[#111827] text-white flex flex-col">

    {/* Header */}
    <div className="py-5 text-center">
      <h1 className="text-xl font-semibold">
        {show.movie?.title}
      </h1>

      <p className="text-sm text-gray-400 mt-1">
        {show.theater?.name} •{" "}
        {new Date(show.screenTime).toLocaleString()}
      </p>
    </div>

    {/* Screen */}
    <div className="flex justify-center mb-8">
      <div className="relative w-[85%] max-w-xl">
        <div className="h-5 rounded-full bg-gradient-to-b from-gray-300 to-gray-500 shadow-xl" />
        <p className="text-center text-[11px] tracking-[8px] text-gray-400 mt-2">
          SCREEN
        </p>
      </div>
    </div>

    {/* Seats */}
    <div className="flex justify-center">
      <div className="space-y-4">
        {rows.map(({ row, seats }) => (
          <div
            key={row}
            className="flex items-center gap-4"
          >
            <div className="w-4 text-xs text-gray-500">
              {row}
            </div>

            <div className="grid grid-cols-16 gap-2">
              {seats.map((seat, index) => (
                <>
                  {index === 8 && (
                    <div className="w-6"></div>
                  )}

                  <SeatButton
                    key={seat.seatId}
                    seat={seat}
                    isMine={selected.has(seat.seatId)}
                    onClick={() => toggleSeat(seat)}
                  />
                </>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom */}
    <div className="mt-auto bg-[#0f172a] border-t border-gray-700">
      <div className="flex justify-center gap-8 py-3">

        <Legend swatch="bg-gray-500" label="Available" />

        <Legend swatch="bg-yellow-400" label="Selected" />

        <Legend swatch="bg-gray-800 border border-gray-600" label="Locked" />

        <Legend swatch="bg-gray-900" label="Booked" />

      </div>

      <div className="border-t border-gray-700 px-6 py-4 flex justify-between items-center">

        <div>
          <p className="text-sm text-gray-400">
            {selectedSeats.length} Seat
          </p>

          <p className="text-xl font-bold">
            ₹{total}
          </p>
        </div>

        <button
          onClick={confirmBooking}
          disabled={selectedSeats.length === 0 || booking}
          className="bg-yellow-400 text-black font-semibold px-7 py-3 rounded-lg disabled:opacity-50"
        >
          {booking ? "Booking..." : "Select Seats"}
        </button>

      </div>
    </div>
  </div>
  <SeatCountModal
  open={showSeatModal}
  movieTitle={show.movie?.title}
  count={seatCount}
  max={10}
  onChangeCount={setSeatCount}
  onConfirm={() => setShowSeatModal(false)}
/>
</>
);
}

function SeatButton({ seat, isMine, onClick }) {

  let color =
    "bg-gray-500 hover:bg-gray-400 text-transparent";

  let disabled = false;

  if (seat.status === "booked") {
    color =
      "bg-gray-900 text-transparent";
    disabled = true;
  }

  else if (seat.status === "locked" && !isMine) {
    color =
      "bg-gray-700 text-transparent";
    disabled = true;
  }

  else if (isMine) {
    color =
      "bg-yellow-400 text-black";
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-5 h-5 rounded-sm border border-gray-600 transition ${color}`}
      title={seat.seatId}
    >
      {isMine ? seat.number : ""}
    </button>
  );
}

function Legend({ swatch, label }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className={`w-3 h-3 rounded ${swatch}`}></span>
      {label}
    </div>
  );
}

// ---- helpers ----
function groupByRow(seats) {
  const map = new Map();
  seats.forEach((seat) => {
    if (!map.has(seat.row)) map.set(seat.row, []);
    map.get(seat.row).push(seat);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, list]) => ({
      row,
      seats: list.sort((a, b) => a.number - b.number),
    }));
}

function patchSeat(show, seatId, patch) {
  if (!show) return show;
  return {
    ...show,
    seats: show.seats.map((s) => (s.seatId === seatId ? { ...s, ...patch } : s)),
  };
}

function dropSeat(set, seatId) {
  const next = new Set(set);
  next.delete(seatId);
  return next;
}