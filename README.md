# cinema-booking
# Cinema Booking – Server

Node.js/Express + MongoDB + Socket.IO backend for a BookMyShow-style cinema booking app.

## Setup

```bash
cd server
npm install
```

Edit `.env` with your MongoDB URI and JWT secret (a template is already included).

```bash
npm run dev   # nodemon, http://localhost:5000
```

## API Overview

| Method | Route                     | Access        | Description                        |
|--------|----------------------------|---------------|------------------------------------|
| POST   | /api/auth/register         | Public        | Register a user                    |
| POST   | /api/auth/login            | Public        | Login, returns JWT                 |
| GET    | /api/auth/profile          | Private       | Get current user                   |
| GET    | /api/movies                | Public        | List movies                        |
| POST   | /api/movies                | Admin         | Add movie                          |
| GET    | /api/theaters?city=        | Public        | List theaters                      |
| POST   | /api/theaters              | Admin         | Add theater                        |
| POST   | /api/shows                 | Admin         | Create a show (auto seat layout)   |
| GET    | /api/shows?movie=&city=&date= | Public     | List shows with filters            |
| GET    | /api/shows/:id             | Public        | Show details + live seat map       |
| POST   | /api/bookings               | Private      | Confirm booking for selected seats |
| GET    | /api/bookings/my            | Private      | Logged-in user's bookings          |
| PUT    | /api/bookings/:id/cancel    | Private      | Cancel a booking, free the seats   |

## Real-time seats (Socket.IO)

Client emits `joinShow(showId)`, then `lockSeat({showId, seatId})` while a user has a seat selected,
and `unlockSeat` when deselected. Server broadcasts `seatLocked` / `seatUnlocked` / `seatsBooked` to
everyone viewing that show so seat maps stay in sync across users.

To create sample data, register an admin user, then manually flip their `role` to `"admin"` in MongoDB,
then use their JWT to POST movies/theaters/shows.
