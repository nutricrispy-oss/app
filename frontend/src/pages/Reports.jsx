import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { fmtGs, fmtDate, todayIso } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText } from "lucide-react";

export default function Reports() {
  const [from, setFrom] = useState(todayIso().slice(0, 8) + "01");
  const [to, setTo] = useState(todayIso());
  const [modality, setModality] = useState("all");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState(null);

  const run = async () => {
    try {
      const params = { from, to };
      if (modality !== "all") params.modality = modality;
      if (status !== "all") params.status = status;
      const { data } = await api.get("/reports", { params });
      setData(data);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const exportPdf = () => {
    if (!data) return;
    const w = window.open("", "_blank");
    const loans = data.loans.map(l => `<tr><td>${l.created_at.slice(0,10)}</td><td>${fmtGs(l.capital)}</td><td>${fmtGs(l.total)}</td><td>${l.modality}</td><td>${l.status}</td></tr>`).join("");
    w.document.write(`<html><head><title>Reporte</title>
<style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}th,td{border:1px solid #ddd;padding:6px}</style></head><body>
<h1>Reporte financiero</h1><p>Período: ${from} al ${to}</p>
<h3>Totales</h3>
<p>Créditos: ${fmtGs(data.totals.loans_amount)} · Cobros: ${fmtGs(data.totals.payments_amount)} · Egresos: ${fmtGs(data.totals.expenses_amount)} · Extracciones: ${fmtGs(data.totals.withdrawals_amount)}</p>
<h3>Créditos otorgados (${data.loans.length})</h3>
<table><thead><tr><th>Fecha</th><th>Capital</th><th>Total</th><th>Modalidad</th><th>Estado</th></tr></thead><tbody>${loans}</tbody></table>
</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4" data-testid="reports-page">
      <div><div className="overline">Análisis</div><h1 className="font-display text-3xl md:text-4xl font-bold">Reportes</h1></div>

      <div className="bg-white border border-border rounded-md p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div><Label>Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="rep-from" /></div>
        <div><Label>Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="rep-to" /></div>
        <div><Label>Modalidad</Label>
          <Select value={modality} onValueChange={setModality}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="diario">Diario</SelectItem><SelectItem value="semanal">Semanal</SelectItem><SelectItem value="quincenal">Quincenal</SelectItem><SelectItem value="mensual">Mensual</SelectItem>
          </SelectContent></Select>
        </div>
        <div><Label>Estado</Label>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem><SelectItem value="renovado">Renovado</SelectItem>
          </SelectContent></Select>
        </div>
        <div className="flex items-end gap-2"><Button className="flex-1" onClick={run} data-testid="btn-run-report">Generar</Button>{data && <Button variant="outline" onClick={exportPdf} data-testid="btn-export-pdf"><FileText size={16}/></Button>}</div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-border rounded-md p-4"><div className="overline">Créditos</div><div className="kpi-value text-2xl mt-1">{fmtGs(data.totals.loans_amount)}</div></div>
            <div className="bg-white border border-border rounded-md p-4"><div className="overline">Cobros</div><div className="kpi-value text-2xl mt-1 text-primary">{fmtGs(data.totals.payments_amount)}</div></div>
            <div className="bg-white border border-border rounded-md p-4"><div className="overline">Egresos</div><div className="kpi-value text-2xl mt-1 text-accent">{fmtGs(data.totals.expenses_amount)}</div></div>
            <div className="bg-white border border-border rounded-md p-4"><div className="overline">Extracciones</div><div className="kpi-value text-2xl mt-1 text-accent">{fmtGs(data.totals.withdrawals_amount)}</div></div>
          </div>
          <div className="bg-white border border-border rounded-md overflow-hidden">
            <div className="p-4 border-b border-border overline">Créditos ({data.loans.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-2">Fecha</th><th className="p-2 text-right">Capital</th><th className="p-2 text-right">Total</th><th className="p-2">Modalidad</th><th className="p-2">Estado</th></tr></thead>
              <tbody>{data.loans.map((l) => (<tr key={l.id} className="border-t border-border"><td className="p-2">{fmtDate(l.created_at)}</td><td className="p-2 text-right tabular-nums">{fmtGs(l.capital)}</td><td className="p-2 text-right tabular-nums">{fmtGs(l.total)}</td><td className="p-2 capitalize">{l.modality}</td><td className="p-2">{l.status}</td></tr>))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
