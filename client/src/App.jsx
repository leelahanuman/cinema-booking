import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import MovieDetails from "./pages/MovieDetails";
import SeatSelection from "./pages/SeatSelection";
import MainLayout from "./layouts/MainLayout";
import { AuthProvider } from "./context/AuthContext";
import SeatSelection from "./pages/SeatSelection";
import BookingConfirmation from "./pages/BookingConfirmation";
import MyBookings from "./pages/MyBookings";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/movies/:id" element={<MovieDetails />} />
            <Route path="/shows/:showId/seats" element={<SeatSelection />} />
<<<<<<< HEAD
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/bookings/:id" element={<BookingConfirmation />} />
=======
>>>>>>> 3029e4fd58e407cf7266c11137687d03c8039fef
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;