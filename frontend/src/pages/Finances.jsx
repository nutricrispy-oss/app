import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { fmtGs, fmtDate, todayIso } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CATS = ["Combustible", "Sueldos", "Transporte", "Gastos administrativos", "Comisiones", "Otros"];

export default function Finances() {
  const [expenses, setExpenses] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [exp, setExp] = useState({ concept: "", category: "Otros", amount: "", description: "", date: todayIso() });
  const [wit, setWit] = useState({ amount: "", reason: "", notes: "", date: todayIso() });

  const load = async () => {
    const [e, w] = await Promise.all([api.get("/expenses"), api.get("/withdrawals")]);
    setExpenses(e.data); setWithdrawals(w.data);
  };
  useEffect(() => { load(); }, []);

  const saveExp = async () => {
    try { await api.post("/expenses", { ...exp, amount: Number(exp.amount) }); toast.success("Egreso registrado"); setExp({ concept: "", category: "Otros", amount: "", description: "", date: todayIso() }); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const saveWit = async () => {
    try { await api.post("/withdrawals", { ...wit, amount: Number(wit.amount) }); toast.success("Extracción registrada"); setWit({ amount: "", reason: "", notes: "", date: todayIso() }); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-4" data-testid="finances-page">
      <div><div className="overline">Control</div><h1 className="font-display text-3xl md:text-4xl font-bold">Ingresos y egresos</h1></div>

      <Tabs defaultValue="expenses">
        <TabsList><TabsTrigger value="expenses" data-testid="tab-expenses">Egresos</TabsTrigger><TabsTrigger value="withdrawals" data-testid="tab-withdrawals">Extracciones</TabsTrigger></TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="bg-white border border-border rounded-md p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2"><Label>Concepto</Label><Input value={exp.concept} onChange={(e) => setExp({ ...exp, concept: e.target.value })} data-testid="exp-concept" /></div>
            <div><Label>Categoría</Label>
              <Select value={exp.category} onValueChange={(v) => setExp({ ...exp, category: v })}>
                <SelectTrigger data-testid="exp-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Monto</Label><Input type="number" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} data-testid="exp-amount" /></div>
            <div><Label>Fecha</Label><Input type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={saveExp} data-testid="btn-save-exp" disabled={!exp.concept || !exp.amount}>Registrar</Button></div>
          </div>
          <div className="bg-white border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-2">Fecha</th><th className="p-2">Concepto</th><th className="p-2">Categoría</th><th className="p-2 text-right">Monto</th></tr></thead>
              <tbody>{expenses.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sin egresos.</td></tr>}
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-border"><td className="p-2">{fmtDate(e.date)}</td><td className="p-2">{e.concept}</td><td className="p-2">{e.category}</td><td className="p-2 text-right tabular-nums">{fmtGs(e.amount)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <div className="bg-white border border-border rounded-md p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2"><Label>Motivo</Label><Input value={wit.reason} onChange={(e) => setWit({ ...wit, reason: e.target.value })} data-testid="wit-reason" /></div>
            <div><Label>Monto</Label><Input type="number" value={wit.amount} onChange={(e) => setWit({ ...wit, amount: e.target.value })} data-testid="wit-amount" /></div>
            <div><Label>Fecha</Label><Input type="date" value={wit.date} onChange={(e) => setWit({ ...wit, date: e.target.value })} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={saveWit} data-testid="btn-save-wit" disabled={!wit.reason || !wit.amount}>Registrar</Button></div>
          </div>
          <div className="bg-white border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-2">Fecha</th><th className="p-2">Motivo</th><th className="p-2 text-right">Monto</th></tr></thead>
              <tbody>{withdrawals.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sin extracciones.</td></tr>}
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-border"><td className="p-2">{fmtDate(w.date)}</td><td className="p-2">{w.reason}</td><td className="p-2 text-right tabular-nums">{fmtGs(w.amount)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
