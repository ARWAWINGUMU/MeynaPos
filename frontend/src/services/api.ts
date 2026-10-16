import axios from "axios";
import { clearSession, getStoredToken } from "../utils/authStorage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    if (method && ["post", "put", "patch", "delete"].includes(method) && /^\/?(products|categories)(\/|$)/.test(response.config.url ?? "")) {
      window.dispatchEvent(new Event("meynapos:catalog-changed"));
    }
    if (method && ["post", "put", "patch", "delete"].includes(method)
      && (/^\/?(sales|products|inventory|purchases)(\/|$)/.test(response.config.url ?? "")
        || /^\/?open-sales\/[^/]+\/complete$/.test(response.config.url ?? ""))) {
      window.dispatchEvent(new Event("meynapos:inventory-changed"));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("meynapos:unauthorized"));
    }
    return Promise.reject(error);
  },
);
