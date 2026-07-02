import api from "./api";

export const registerUser = (data) => api.post("/auth/register", data).then((res) => res.data);

export const loginUser = (data) => api.post("/auth/login", data).then((res) => res.data);

export const getProfile = () => api.get("/auth/profile").then((res) => res.data);