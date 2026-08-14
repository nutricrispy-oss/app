import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { fmtGs, todayIso, MODALITIES } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function NewLoan() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const preSelected = sp.get("client") || "";
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    client_id: preSelected, capital: "", interest_rate: 26, installments: 30,
    modality: "diario", start_date: todayIso(), first_due_date: todayIso(),
  });
  const [preview, setPreview] = useState(null);

  useEffect(() => { api.get("/clients").then((r) => setClients(r.data)); }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const calculate = async () => {
    try {
      const payload = { ...form, capital: Number(form.capital), interest_rate: Number(form.interest_rate), installments: Number(form.installments) };
      const { data } = await api.post("/loans/calculate", payload);
      setPreview(data);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const confirm = async () => {
    try {
      const payload = { ...form, capital: Number(form.capital), interest_rate: Number(form.interest_rate), installments: Number(form.installments) };
      const { data } = await api.post("/loans", payload);
      toast.success("Préstamo creado");
      nav(`/prestamos/${data.id}`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="new-loan-page">
      <div>
        <div className="overline">Calculadora</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Nuevo préstamo</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-md p-5 space-y-4">
          <div>
            <Label>Cliente *</Label>
            <Select value={form.client_id} onValueChange={upd("client_id")}>
              <SelectTrigger data-testid="nl-client"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto solicitado (Gs.) *</Label>
            <Input data-testid="nl-capital" type="number" value={form.capital} onChange={upd("capital")} placeholder="1000000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Interés (%)</Label>
              <Input data-testid="nl-rate" type="number" step="0.1" value={form.interest_rate} onChange={upd("interest_rate")} />
            </div>
            <div>
              <Label>Cuotas</Label>
              <Input data-testid="nl-installments" type="number" value={form.installments} onChange={upd("installments")} />
            </div>
          </div>
          <div>
            <Label>Modalidad</Label>
            <Select value={form.modality} onValueChange={upd("modality")}>
              <SelectTrigger data-testid="nl-modality"><SelectValue /></SelectTrigger>
              <SelectContent>{MODALITIES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha de entrega</Label>
              <Input type="date" value={form.start_date} onChange={upd("start_date")} />
            </div>
            <div>
              <Label>Primer vencimiento</Label>
              <Input type="date" value={form.first_due_date} onChange={upd("first_due_date")} />
            </div>
          </div>
          <Button className="w-full h-11" onClick={calculate} data-testid="nl-calc" disabled={!form.client_id || !form.capital}>Calcular</Button>
        </div>

        <div className="bg-white border border-border rounded-md p-5 space-y-3">
          <div className="overline">Resumen</div>
          <div className="flex justify-between border-b border-border pb-2"><span>Capital</span><span className="tabular-nums font-medium">{fmtGs(Number(form.capital || 0))}</span></div>
          <div className="flex justify-between border-b border-border pb-2"><span>Interés</span><span className="tabular-nums font-medium">{fmtGs(preview?.interest || 0)}</span></div>
          <div className="flex justify-between border-b border-border pb-2"><span>Total a devolver</span><span className="tabular-nums font-bold text-primary">{fmtGs(preview?.total || 0)}</span></div>
          <div className="flex justify-between border-b border-border pb-2"><span>Cuota</span><span className="tabular-nums font-bold">{fmtGs(preview?.installment_amount || 0)}</span></div>
          <div className="text-xs text-muted-foreground">Modalidad: {form.modality} · {form.installments} cuotas</div>
          {preview && (
            <Button className="w-full h-11 mt-3" onClick={confirm} data-testid="nl-confirm">Confirmar crédito</Button>
          )}
        </div>
      </div>

      {preview && (
        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="p-4 overline border-b border-border">Cronograma</div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 sticky top-0"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Vencimiento</th><th className="p-2 text-right">Monto</th></tr></thead>
              <tbody>{preview.schedule.map((s) => (
                <tr key={s.number} className="border-t border-border"><td className="p-2">{s.number}</td><td className="p-2">{s.due_date}</td><td className="p-2 text-right tabular-nums">{fmtGs(s.amount)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
