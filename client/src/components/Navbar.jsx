import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        🎬 CineBook
      </Link>
      <nav className="navbar-links">
        <Link to="/">Movies</Link>
        {user ? (
          <>
            <Link to="/my-bookings">My Bookings</Link>
            <span className="navbar-user">Hi, {user.name.split(" ")[0]}</span>
            <button onClick={handleLogout} className="btn-link">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register" className="btn-primary-outline">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};

export default Navbar;