const Show = require("../models/Show");

const { SEAT_LOCK_TIMEOUT_MS: LOCK_TIMEOUT_MS } = require("../config/constants");

const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client joins the "room" for a specific show to receive live seat updates
    socket.on("joinShow", (showId) => {
      socket.join(`show:${showId}`);
    });

    socket.on("leaveShow", (showId) => {
      socket.leave(`show:${showId}`);
    });

    // Temporarily lock a seat while a user is selecting it (before payment/confirm)
    socket.on("lockSeat", async ({ showId, seatId }) => {
      try {
        const show = await Show.findById(showId);
        if (!show) return;

        const seat = show.seats.find((s) => s.seatId === seatId);
        if (!seat) return;

        const lockExpired =
          seat.lockedAt && Date.now() - new Date(seat.lockedAt).getTime() > LOCK_TIMEOUT_MS;

        if (seat.status === "booked") {
          socket.emit("seatUnavailable", { seatId });
          return;
        }

        if (seat.status === "locked" && seat.lockedBy !== socket.id && !lockExpired) {
          socket.emit("seatUnavailable", { seatId });
          return;
        }

        seat.status = "locked";
        seat.lockedBy = socket.id;
        seat.lockedAt = new Date();
        await show.save();

        io.to(`show:${showId}`).emit("seatLocked", { seatId, lockedBy: socket.id });
      } catch (error) {
        console.error("lockSeat error:", error.message);
      }
    });

    // Release a lock when a user deselects a seat
    socket.on("unlockSeat", async ({ showId, seatId }) => {
      try {
        const show = await Show.findById(showId);
        if (!show) return;

        const seat = show.seats.find((s) => s.seatId === seatId);
        if (!seat || seat.status !== "locked" || seat.lockedBy !== socket.id) return;

        seat.status = "available";
        seat.lockedBy = null;
        seat.lockedAt = null;
        await show.save();

        io.to(`show:${showId}`).emit("seatUnlocked", { seatId });
      } catch (error) {
        console.error("unlockSeat error:", error.message);
      }
    });

    // Notify everyone in the room that a seat is now permanently booked
    socket.on("seatBooked", ({ showId, seats }) => {
      io.to(`show:${showId}`).emit("seatsBooked", { seats });
    });

    // Release any locks this socket was holding if it disconnects mid-selection
    socket.on("disconnect", async () => {
      try {
        const shows = await Show.find({ "seats.lockedBy": socket.id });
        for (const show of shows) {
          let changed = false;
          show.seats.forEach((seat) => {
            if (seat.lockedBy === socket.id) {
              seat.status = "available";
              seat.lockedBy = null;
              seat.lockedAt = null;
              changed = true;
            }
          });
          if (changed) {
            await show.save();
            io.to(`show:${show._id}`).emit("seatsReleased");
          }
        }
      } catch (error) {
        console.error("disconnect cleanup error:", error.message);
      }
    });
  });
};

module.exports = registerSocketHandlers;