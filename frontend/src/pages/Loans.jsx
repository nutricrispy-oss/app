import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { fmtGs, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default function Loans() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/loans").then((r) => setItems(r.data)); }, []);

  return (
    <div className="space-y-4" data-testid="loans-page">
      <div className="flex items-center justify-between">
        <div><div className="overline">Cartera</div><h1 className="font-display text-3xl md:text-4xl font-bold">Préstamos</h1></div>
        <Link to="/prestamos/nuevo"><Button data-testid="btn-goto-new-loan"><Plus size={16} className="mr-1" />Nuevo</Button></Link>
      </div>
      <div className="bg-white border border-border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Cliente</th>
              <th className="p-3 text-right">Capital</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Modalidad</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin préstamos aún.</td></tr>}
            {items.map((l) => (
              <tr key={l.id} className="border-t border-border hover:bg-secondary/40" data-testid={`row-loan-${l.id}`}>
                <td className="p-3"><Link className="text-primary" to={`/prestamos/${l.id}`}>{fmtDate(l.created_at)}</Link></td>
                <td className="p-3">{l.client?.first_name} {l.client?.last_name} <span className="text-xs text-muted-foreground font-mono">{l.client?.code}</span></td>
                <td className="p-3 text-right tabular-nums">{fmtGs(l.capital)}</td>
                <td className="p-3 text-right tabular-nums font-medium">{fmtGs(l.total)}</td>
                <td className="p-3 capitalize">{l.modality}</td>
                <td className="p-3"><Badge>{l.status.replace("_", " ")}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
