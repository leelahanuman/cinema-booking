import { useEffect, useMemo } from "react";

const rowLetters = "ABCDEFGHIJ";

const SeatMap = ({ seats, selectedSeats, onToggleSeat }) => {
  const rows = useMemo(() => {
    const grouped = {};
    seats.forEach((seat) => {
      const row = seat.seatId.match(/^[A-Z]+/)[0];
      if (!grouped[row]) grouped[row] = [];
      grouped[row].push(seat);
    });
    return Object.keys(grouped)
      .sort()
      .map((row) => ({
        row,
        seats: grouped[row].sort(
          (a, b) =>
            parseInt(a.seatId.replace(/^[A-Z]+/, ""), 10) -
            parseInt(b.seatId.replace(/^[A-Z]+/, ""), 10)
        ),
      }));
  }, [seats]);

  const seatClass = (seat) => {
    if (seat.status === "booked") return "seat seat-booked";
    if (selectedSeats.includes(seat.seatId)) return "seat seat-selected";
    if (seat.status === "locked") return "seat seat-locked";
    return "seat seat-available";
  };

  return (
    <div className="seat-map">
      <div className="screen">SCREEN</div>
      {rows.map(({ row, seats: rowSeats }) => (
        <div className="seat-row" key={row}>
          <span className="row-label">{row}</span>
          {rowSeats.map((seat) => (
            <button
              key={seat.seatId}
              className={seatClass(seat)}
              disabled={seat.status === "booked" || seat.status === "locked"}
              onClick={() => onToggleSeat(seat.seatId)}
              title={seat.seatId}
            >
              {seat.seatId.replace(/^[A-Z]+/, "")}
            </button>
          ))}
        </div>
      ))}
      <div className="seat-legend">
        <span><i className="seat seat-available" /> Available</span>
        <span><i className="seat seat-selected" /> Selected</span>
        <span><i className="seat seat-locked" /> Locked</span>
        <span><i className="seat seat-booked" /> Booked</span>
      </div>
    </div>
  );
};

export default SeatMap;