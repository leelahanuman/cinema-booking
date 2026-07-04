import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShowById, createBooking } from "../services/bookingService";
import { getSocket } from "../services/socketService";
import SeatCountModal from "../components/SeatCountModal";
// Matches server/models/Show.js seat sub-document: { seatId, row, number, category, status, lockedBy }
// status is one of "available" | "locked" | "booked" (server/socket/socketHandlers.js, server/controllers/bookingController.js)

// Seat sub-document only has { seatId, status, lockedBy, lockedAt } — row/number
// are NOT stored separately, so we parse them out of seatId (e.g. "A1" -> row "A", number 1).
function parseSeatId(seatId) {
  const match = /^([A-Za-z]+)(\d+)$/.exec(seatId || "");
  if (!match) return { row: seatId || "?", number: 0 };
  return { row: match[1], number: Number(match[2]) };
}

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
      if (selected.size >= seatCount) {
        setError(`You can only pick ${seatCount} seat${seatCount > 1 ? "s" : ""}. Deselect one first.`);
        return;
      }
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
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2036_0%,_#0a0d18_60%)] text-white flex flex-col">

        {/* Header */}
        <div className="pt-6 pb-2 text-center">
          <h1 className="text-lg font-semibold">
            {show.movie?.title}
          </h1>

          <p className="text-xs text-gray-400 mt-1">
            {show.theater?.name} •{" "}
            {formatShowDateTime(show.date, show.time)}
          </p>
        </div>

        {error && (
          <p className="text-center text-xs text-red-400 mt-1 mb-1">{error}</p>
        )}

        {/* Screen */}
        <div className="flex justify-center mt-4 mb-8">
          <div className="w-[70%] max-w-md">
            <div
              className="h-4 bg-gradient-to-b from-slate-200/80 to-slate-400/10"
              style={{
                borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                boxShadow: "0 6px 24px 4px rgba(180,200,255,0.25)",
              }}
            />
            <p className="text-center text-[10px] tracking-[6px] text-gray-500 mt-2">
              SCREEN
            </p>
          </div>
        </div>

        {/* Seats */}
        <div className="flex justify-center px-4 overflow-x-auto flex-1">
          <div className="bg-white/[0.03] rounded-2xl px-6 py-6">
            <div className="space-y-1.5">
              {rows.map(({ row, seats }) => {
                const third = Math.max(1, Math.round(seats.length / 3));
                return (
                  <div key={row} className="flex items-center gap-3">
                    <div className="w-3 text-[10px] text-gray-500 text-right shrink-0">
                      {row}
                    </div>

                    <div className="flex items-center gap-[3px]">
                      {seats.map((seat, index) => (
                        <div key={seat.seatId} className="flex items-center gap-[3px]">
                          {(index === third || index === third * 2) && (
                            <div className="w-2" />
                          )}
                          <SeatButton
                            seat={seat}
                            isMine={selected.has(seat.seatId)}
                            onClick={() => toggleSeat(seat)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-4 bg-[#0d1120] border-t border-white/5">
          <div className="flex justify-center gap-8 py-4">
            <Legend swatch="bg-slate-400" label="Available" />
            <Legend swatch="bg-yellow-400" label="Selected" />
            <Legend swatch="bg-slate-700" label="Reserved" />
          </div>

          <div className="border-t border-white/5 px-6 py-4 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">
                {selectedSeats.length} Seat{selectedSeats.length !== 1 ? "s" : ""}
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
        price={show.price}
        onChangeCount={setSeatCount}
        onConfirm={() => setShowSeatModal(false)}
        onSkip={() => setShowSeatModal(false)}
      />
    </>
  );
}

function SeatButton({ seat, isMine, onClick }) {
  let color = "bg-slate-400 hover:bg-slate-300 text-transparent";
  let disabled = false;

  if (seat.status === "booked") {
    color = "bg-slate-700/70 text-transparent cursor-not-allowed";
    disabled = true;
  } else if (seat.status === "locked" && !isMine) {
    color = "bg-slate-600/70 text-transparent cursor-not-allowed";
    disabled = true;
  } else if (isMine) {
    color = "bg-yellow-400 text-black font-semibold";
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={seat.seatId}
      className={`w-[13px] h-[13px] rounded-[3px] text-[7px] leading-none transition-transform active:scale-90 ${color}`}
    >
      {isMine ? parseSeatId(seat.seatId).number : ""}
    </button>
  );
}

function Legend({ swatch, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
      <span className={`w-2.5 h-2.5 rounded-full ${swatch}`}></span>
      {label}
    </div>
  );
}

// ---- helpers ----
function groupByRow(seats) {
  const map = new Map();
  seats.forEach((seat) => {
    const { row } = parseSeatId(seat.seatId);
    if (!map.has(row)) map.set(row, []);
    map.get(row).push(seat);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, list]) => ({
      row,
      seats: list.sort((a, b) => parseSeatId(a.seatId).number - parseSeatId(b.seatId).number),
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

// Show schema stores date ("YYYY-MM-DD") and time ("HH:mm") as separate strings,
// not a combined screenTime — combine them here instead of new Date(show.screenTime),
// which was always Invalid Date.
function formatShowDateTime(date, time) {
  if (!date || !time) return "Time unavailable";
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