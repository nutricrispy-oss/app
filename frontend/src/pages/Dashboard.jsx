import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtGs } from "@/lib/format";
import { Link } from "react-router-dom";
import { Users, HandCoins, Wallet, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function KPI({ label, value, testid, tone = "default", icon: Icon }) {
  const tones = {
    default: "text-foreground",
    primary: "text-primary",
    accent: "text-accent",
    warn: "text-[hsl(var(--accent))]",
  };
  return (
    <div data-testid={testid} className="bg-white border border-border rounded-md p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="overline">{label}</div>
        {Icon && <Icon size={16} className="text-muted-foreground" />}
      </div>
      <div className={`kpi-value text-2xl md:text-3xl mt-2 tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  const load = async () => {
    const { data } = await api.get("/dashboard");
    setData(data);
  };
  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="overline">Panel</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Resumen del negocio</h1>
        </div>
        <button onClick={load} className="p-2 rounded-md border border-border hover:bg-secondary" data-testid="btn-refresh"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI testid="kpi-clientes-total" label="Clientes" value={data.clients_total} icon={Users} />
        <KPI testid="kpi-clientes-activos" label="Clientes activos" value={data.active_clients} icon={Users} />
        <KPI testid="kpi-prestamos-activos" label="Préstamos activos" value={data.active_loans} icon={HandCoins} />
        <KPI testid="kpi-capital-prestado" label="Capital prestado" value={fmtGs(data.capital_lent)} tone="primary" />
        <KPI testid="kpi-total-otorgado" label="Total otorgado" value={fmtGs(data.total_granted)} />
        <KPI testid="kpi-pendiente-cobrar" label="Pendiente por cobrar" value={fmtGs(data.pending_amount)} tone="accent" />
        <KPI testid="kpi-cobros-hoy" label="Cobros hoy" value={fmtGs(data.collected_today)} tone="primary" />
        <KPI testid="kpi-cobros-mes" label="Cobros del mes" value={fmtGs(data.collected_month)} />
        <KPI testid="kpi-intereses" label="Intereses cobrados" value={fmtGs(data.interest_collected)} />
        <KPI testid="kpi-renovaciones" label="Renovaciones" value={data.renewals_count} />
        <KPI testid="kpi-egresos-mes" label="Egresos del mes" value={fmtGs(data.expenses_month)} tone="accent" />
        <KPI testid="kpi-extracciones-mes" label="Extracciones mes" value={fmtGs(data.withdrawals_month)} tone="accent" />
        <KPI testid="kpi-saldo" label="Saldo disponible" value={fmtGs(data.available_balance)} tone="primary" icon={Wallet} />
        <KPI testid="kpi-vencidas" label="Cuotas vencidas" value={data.overdue_count} tone="accent" icon={AlertTriangle} />
        <KPI testid="kpi-atrasados" label="Clientes atrasados" value={data.late_clients_count} tone="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-border rounded-md p-4">
          <div className="overline mb-2">Cobros últimos 7 días</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.trend_7d}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtGs(v)} />
                <Line type="monotone" dataKey="amount" stroke="hsl(164 86% 16%)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-border rounded-md p-4">
          <div className="overline mb-3">Acciones rápidas</div>
          <div className="space-y-2">
            <Link to="/prestamos/nuevo" data-testid="quick-new-loan" className="block w-full text-center py-3 rounded-md bg-primary text-primary-foreground font-semibold">Nuevo préstamo</Link>
            <Link to="/clientes" data-testid="quick-clients" className="block w-full text-center py-3 rounded-md border border-border font-medium hover:bg-secondary">Ver clientes</Link>
            <Link to="/caja" data-testid="quick-cash" className="block w-full text-center py-3 rounded-md border border-border font-medium hover:bg-secondary">Caja diaria</Link>
            <Link to="/reportes" data-testid="quick-reports" className="block w-full text-center py-3 rounded-md border border-border font-medium hover:bg-secondary">Reportes</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
