import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { fmtGs, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Cash() {
  const [today, setToday] = useState(null);
  const [closes, setCloses] = useState([]);

  const load = async () => {
    const [t, c] = await Promise.all([api.get("/cash/today"), api.get("/cash/closes")]);
    setToday(t.data); setCloses(c.data);
  };
  useEffect(() => { load(); }, []);

  const close = async () => {
    try { await api.post("/cash/close"); toast.success("Cierre registrado"); load(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  if (!today) return <div className="text-muted-foreground">Cargando…</div>;

  const rows = [
    ["Saldo inicial", today.initial_balance],
    ["+ Cobros del día", today.income],
    ["- Créditos nuevos", -today.new_loans],
    ["- Renovaciones (capital adicional)", -today.renewals],
    ["- Egresos", -today.expenses],
    ["- Extracciones", -today.withdrawals],
  ];

  return (
    <div className="space-y-6" data-testid="cash-page">
      <div className="flex justify-between items-start gap-4">
        <div><div className="overline">Movimiento</div><h1 className="font-display text-3xl md:text-4xl font-bold">Caja diaria</h1><div className="text-sm text-muted-foreground mt-1">Fecha: {fmtDate(today.date)}</div></div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button data-testid="btn-close-cash">Cerrar caja</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirmar cierre</AlertDialogTitle>
              <AlertDialogDescription>El saldo final ({fmtGs(today.final_balance)}) se guardará como inicio del próximo día.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={close}>Confirmar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([l, v]) => (
              <tr key={l} className="border-b border-border"><td className="p-3">{l}</td><td className="p-3 text-right tabular-nums font-medium">{fmtGs(v)}</td></tr>
            ))}
            <tr className="bg-primary/5"><td className="p-3 font-bold">Saldo final esperado</td><td className="p-3 text-right tabular-nums font-bold text-primary text-lg">{fmtGs(today.final_balance)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <div className="p-4 border-b border-border overline">Historial de cierres</div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left"><tr><th className="p-2">Fecha</th><th className="p-2 text-right">Ingresos</th><th className="p-2 text-right">Egresos</th><th className="p-2 text-right">Saldo final</th></tr></thead>
          <tbody>
            {closes.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sin cierres registrados.</td></tr>}
            {closes.map((c) => (
              <tr key={c.id} className="border-t border-border"><td className="p-2">{fmtDate(c.date)}</td><td className="p-2 text-right tabular-nums">{fmtGs(c.income)}</td><td className="p-2 text-right tabular-nums">{fmtGs(c.expenses + c.withdrawals)}</td><td className="p-2 text-right tabular-nums font-medium">{fmtGs(c.final)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
