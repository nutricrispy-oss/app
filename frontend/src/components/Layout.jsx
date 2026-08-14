import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, HandCoins, Wallet, LineChart, Settings as SettingsIcon, LogOut, Menu, X, PlusCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, testid: "nav-inicio" },
  { to: "/clientes", label: "Clientes", icon: Users, testid: "nav-clientes" },
  { to: "/prestamos", label: "Préstamos", icon: HandCoins, testid: "nav-prestamos" },
  { to: "/caja", label: "Caja", icon: Wallet, testid: "nav-caja" },
  { to: "/finanzas", label: "Finanzas", icon: LineChart, testid: "nav-finanzas" },
  { to: "/reportes", label: "Reportes", icon: LineChart, testid: "nav-reportes" },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon, testid: "nav-configuracion" },
];

const BOTTOM = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, testid: "bnav-inicio" },
  { to: "/clientes", label: "Clientes", icon: Users, testid: "bnav-clientes" },
  { to: "/prestamos/nuevo", label: "Nuevo", icon: PlusCircle, testid: "bnav-nuevo", emphasis: true },
  { to: "/prestamos", label: "Préstamos", icon: HandCoins, testid: "bnav-prestamos" },
  { to: "/caja", label: "Caja", icon: Wallet, testid: "bnav-caja" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 border-r border-border bg-white sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-border">
          <div className="overline">Sistema</div>
          <div className="font-display text-xl font-bold">{user?.business_name || "Préstamos"}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{user?.email}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} data-testid={n.testid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                <Icon size={18} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link to="/prestamos/nuevo" data-testid="sidebar-new-loan"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
            <PlusCircle size={18} /> Nuevo Préstamo
          </Link>
          <button onClick={async () => { await logout(); nav("/login"); }} data-testid="btn-logout"
            className="mt-2 flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - mobile */}
        <header className="md:hidden sticky top-0 z-20 bg-white border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} data-testid="btn-open-menu" className="p-1">
              <Menu size={22} />
            </button>
            <div className="font-display font-bold">{user?.business_name || "Préstamos"}</div>
          </div>
          <button onClick={async () => { await logout(); nav("/login"); }} data-testid="btn-logout-mobile" className="text-sm text-muted-foreground">
            <LogOut size={18} />
          </button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)}>
            <div className="absolute left-0 top-0 h-full w-72 bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="font-display font-bold">Menú</div>
                <button onClick={() => setOpen(false)}><X size={20} /></button>
              </div>
              <div className="space-y-1">
                {NAV.map((n) => {
                  const Icon = n.icon;
                  const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
                  return (
                    <Link key={n.to} to={n.to} onClick={() => setOpen(false)} data-testid={`m-${n.testid}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                      <Icon size={18} /> {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-full">
          {children}
        </main>

        {/* Bottom nav - mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-border pb-safe">
          <div className="grid grid-cols-5">
            {BOTTOM.map((n) => {
              const Icon = n.icon;
              const active = loc.pathname === n.to;
              return (
                <Link key={n.to} to={n.to} data-testid={n.testid}
                  className={`flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`${n.emphasis ? "bg-primary text-primary-foreground rounded-full p-1.5" : ""}`}>
                    <Icon size={n.emphasis ? 22 : 20} />
                  </div>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
