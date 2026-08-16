import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };
  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    // Preserve the token so the background revocation call can still send it
    // (localStorage is cleared immediately for UX, and cross-origin cookies
    // may not be attached on independent deployments).
    const oldToken = localStorage.getItem("token");
    localStorage.removeItem("token");
    setUser(false);
    try {
      const cfg = oldToken ? { headers: { Authorization: `Bearer ${oldToken}` } } : {};
      api.post("/auth/logout", null, cfg).catch(() => {});
    } catch {}
    try { window.location.replace("/login"); } catch {}
  };
  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
