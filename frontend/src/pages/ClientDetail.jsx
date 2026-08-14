import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { fmtGs, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const STATUS_COLORS = {
  activo: "bg-primary/10 text-primary",
  cancelado: "bg-green-100 text-green-800",
  cancelado_anticipado: "bg-blue-100 text-blue-800",
  renovado: "bg-purple-100 text-purple-800",
};

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/clients/${id}`).then((r) => setData(r.data));
  }, [id]);

  if (!data) return <div className="text-muted-foreground">Cargando…</div>;
  const { client, loans } = data;

  return (
    <div className="space-y-6" data-testid="client-detail-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="overline">Cliente {client.code}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{client.first_name} {client.last_name}</h1>
          <div className="text-sm text-muted-foreground mt-1">{client.document || "-"} · {client.phone || "-"} · {client.city || "-"}</div>
        </div>
        <Link to={`/prestamos/nuevo?client=${client.id}`}>
          <Button data-testid="btn-new-loan-client"><Plus size={16} className="mr-1" /> Nuevo préstamo</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-md p-4">
          <div className="overline">Total préstamos</div>
          <div className="kpi-value text-3xl mt-2">{loans.length}</div>
        </div>
        <div className="bg-white border border-border rounded-md p-4">
          <div className="overline">Activos</div>
          <div className="kpi-value text-3xl mt-2 text-primary">{loans.filter(l => l.status === "activo").length}</div>
        </div>
        <div className="bg-white border border-border rounded-md p-4">
          <div className="overline">Cancelados</div>
          <div className="kpi-value text-3xl mt-2">{loans.filter(l => l.status.startsWith("cancelado")).length}</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <div className="p-4 border-b border-border overline">Historial de préstamos</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3 text-right">Capital</th>
              <th className="p-3 text-right">Interés</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Modalidad</th>
              <th className="p-3">Cuotas</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin préstamos.</td></tr>}
            {loans.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-secondary/40">
                <td className="p-3"><Link className="text-primary" to={`/prestamos/${l.id}`}>{fmtDate(l.created_at)}</Link></td>
                <td className="p-3 text-right tabular-nums">{fmtGs(l.capital)}</td>
                <td className="p-3 text-right tabular-nums">{l.interest_rate}%</td>
                <td className="p-3 text-right tabular-nums font-medium">{fmtGs(l.total)}</td>
                <td className="p-3 capitalize">{l.modality}</td>
                <td className="p-3">{l.installments_count}</td>
                <td className="p-3"><Badge className={STATUS_COLORS[l.status] || ""}>{l.status.replace("_", " ")}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
