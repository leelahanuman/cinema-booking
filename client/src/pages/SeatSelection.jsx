import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getShowById, createBooking } from "../services/bookingService";
import { getSocket } from "../services/socketService";
import SeatCountModal from "../components/SeatCountModal";

// Matches server/models/Show.js seat sub-document: { seatId, row, number, category, status, lockedBy }
const CATEGORY_LABEL = { premium: "Premium", classic: "Classic" };

export default function SeatSelection() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [booking, setBooking] = useState(false);

  // seat-count gate — shown once before the seat map is usable
  const [seatCount, setSeatCount] = useState(1);
  const [countLocked, setCountLocked] = useState(false);

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

    const onSeatLocked = ({ seatId, lockedBy }) => {
      if (lockedBy === socket.id) return;
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
      setSelected((prev) => dropSeat(prev, seatId));
      setError(`Seat ${seatId} was just taken. Pick another one.`);
    };
    const onSeatsReleased = async () => {
      try {
        const fresh = await getShowById(showId);
        if (!cancelled) setShow(fresh);
      } catch {
        /* next interaction will resync */
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

  const rows = useMemo(() => groupByRow(show?.seats || []), [show]);

  const selectedSeats = useMemo(
    () => (show?.seats || []).filter((s) => selected.has(s.seatId)),
    [show, selected]
  );

  // bookingController.createBooking bills seats.length * show.price (flat rate,
  // no per-category pricing yet) — this mirrors that so the total shown matches
  // what actually gets charged.
  const total = selectedSeats.length * (show?.price || 0);

  const toggleSeat = (seat) => {
    const socket = socketRef.current;
    if (!socket || !show) return;
    if (seat.status === "booked") return;
    if (seat.status === "locked" && seat.lockedBy !== socket.id) return;

    if (selected.has(seat.seatId)) {
      socket.emit("unlockSeat", { showId, seatId: seat.seatId });
      setSelected((prev) => dropSeat(prev, seat.seatId));
      setShow((prev) => patchSeat(prev, seat.seatId, { status: "available", lockedBy: null }));
      return;
    }

    if (selected.size >= seatCount) {
      setError(
        `You picked ${seatCount} seat${seatCount !== 1 ? "s" : ""} — deselect one first, or start over with a higher count.`
      );
      return;
    }

    socket.emit("lockSeat", { showId, seatId: seat.seatId });
    setSelected((prev) => new Set(prev).add(seat.seatId));
    setShow((prev) => patchSeat(prev, seat.seatId, { status: "locked", lockedBy: socket.id }));
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
      socketRef.current.emit("seatBooked", { showId, seats: selectedSeats.map((s) => s.seatId) });
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-32">
      <SeatCountModal
        open={!countLocked}
        max={10}
        count={seatCount}
        onChangeCount={setSeatCount}
        onConfirm={() => setCountLocked(true)}
        movieTitle={show.movie?.title}
      />

      <header className="px-4 pt-6 pb-4 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{show.movie?.title}</h1>
        <p className="text-sm text-neutral-400">
          {show.theater?.name} · {formatShowTime(show)}
        </p>
      </header>

      {error && (
        <div className="mx-4 mb-4 rounded-md bg-red-950/60 border border-red-800 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <Screen />

      <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-2 px-4">
        {rows.map(({ row, seats }, rowIndex) => (
          <SeatRow
            key={row}
            row={row}
            seats={seats}
            rowIndex={rowIndex}
            totalRows={rows.length}
            selected={selected}
            onToggle={toggleSeat}
          />
        ))}
      </div>

      <div className="mt-10 flex justify-center gap-6 text-xs text-neutral-400">
        <Legend swatch="bg-neutral-700" label="Available" />
        <Legend swatch="bg-amber-400" label="Selected" />
        <Legend swatch="bg-neutral-800 border border-neutral-600" label="Locked" />
        <Legend swatch="bg-neutral-800/50" label="Booked" />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-sm text-neutral-400">
              {selectedSeats.length}/{seatCount} seat{seatCount !== 1 ? "s" : ""}
            </p>
            <p className="text-base font-semibold">₹{total}</p>
          </div>
          <button
            onClick={confirmBooking}
            disabled={selectedSeats.length === 0 || booking}
            className="rounded-lg bg-rose-500 px-6 py-3 font-semibold text-white disabled:opacity-40"
          >
            {booking ? "Booking…" : "Select Seats"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Screen() {
  return (
    <div className="mx-auto mt-2 w-full max-w-xl px-6">
      <svg viewBox="0 0 400 40" className="w-full">
        <path
          d="M10 30 Q200 -5 390 30"
          fill="none"
          stroke="url(#screenGlow)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="screenGlow" x1="0" x2="1">
            <stop offset="0" stopColor="#3f3f46" />
            <stop offset="0.5" stopColor="#facc15" stopOpacity="0.7" />
            <stop offset="1" stopColor="#3f3f46" />
          </linearGradient>
        </defs>
      </svg>
      <p className="mt-1 text-center text-[11px] tracking-[0.3em] text-neutral-500">SCREEN</p>
    </div>
  );
}

// Rows curve like a real auditorium: front rows arc more, seats near the
// row's edges lift slightly, mimicking stadium seating around the screen.
function SeatRow({ row, seats, rowIndex, totalRows, selected, onToggle }) {
  const center = (seats.length - 1) / 2;
  const curveStrength = 10 * (1 - rowIndex / Math.max(totalRows - 1, 1)); // px, decays toward the back

  return (
    <div className="flex items-end gap-1.5">
      <span className="mr-1 w-4 text-right text-[11px] text-neutral-500">{row}</span>
      {seats.map((seat, i) => {
        const dist = center === 0 ? 0 : (i - center) / center;
        const lift = curveStrength * dist * dist;
        return (
          <SeatButton
            key={seat.seatId}
            seat={seat}
            isMine={selected.has(seat.seatId)}
            style={{ transform: `translateY(${lift}px)` }}
            onClick={() => onToggle(seat)}
          />
        );
      })}
    </div>
  );
}

function SeatButton({ seat, isMine, style, onClick }) {
  const base =
    "h-6 w-6 rounded-t-md text-[9px] flex items-center justify-center border transition-colors";
  let cls = "bg-neutral-700 border-neutral-600 hover:bg-neutral-600 cursor-pointer";
  let disabled = false;

  if (seat.status === "booked") {
    cls = "bg-neutral-800/50 border-neutral-800 text-neutral-600 cursor-not-allowed";
    disabled = true;
  } else if (seat.status === "locked" && !isMine) {
    cls = "bg-neutral-800 border-neutral-600 text-neutral-500 cursor-not-allowed";
    disabled = true;
  } else if (isMine) {
    cls = "bg-amber-400 border-amber-300 text-neutral-900 cursor-pointer";
  }

  return (
    <button
      type="button"
      title={`${seat.seatId} · ${CATEGORY_LABEL[seat.category] || seat.category || ""}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`${base} ${cls}`}
    >
      {seat.number}
    </button>
  );
}

function Legend({ swatch, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${swatch}`} />
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
    .map(([row, list]) => ({ row, seats: list.sort((a, b) => a.number - b.number) }));
}

function patchSeat(show, seatId, patch) {
  if (!show) return show;
  return { ...show, seats: show.seats.map((s) => (s.seatId === seatId ? { ...s, ...patch } : s)) };
}

function dropSeat(set, seatId) {
  const next = new Set(set);
  next.delete(seatId);
  return next;
}

// Show docs have used different field names in this project (screenTime,
// showTime, startTime, date). Try each and fall back gracefully instead of
// rendering "Invalid Date".
function formatShowTime(show) {
  const candidate = show.screenTime || show.showTime || show.startTime || show.date;
  if (!candidate) return "Time unavailable";
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return "Time unavailable";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}