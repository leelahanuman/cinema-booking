import { createContext, useEffect, useState } from "react";
import * as authService from "../services/authService";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("cinebook_user");
    const token = localStorage.getItem("cinebook_token");
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const data = await authService.loginUser(credentials);
    persistUser(data);
    return data;
  };

  const register = async (details) => {
    const data = await authService.registerUser(details);
    persistUser(data);
    return data;
  };

  const persistUser = (data) => {
    const { token, ...userInfo } = data;
    localStorage.setItem("cinebook_token", token);
    localStorage.setItem("cinebook_user", JSON.stringify(userInfo));
    setUser(userInfo);
  };

  const logout = () => {
    localStorage.removeItem("cinebook_token");
    localStorage.removeItem("cinebook_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};