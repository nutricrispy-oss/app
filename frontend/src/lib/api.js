import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 8000,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export function formatApiError(detail) {
  if (detail == null) return "Ocurrió un error. Intenta nuevamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}
