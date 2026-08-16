import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError, API_BASE } from "@/lib/api";
import { fmtGs, fmtDate, todayIso, MODALITIES } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HandCoins, FileText, MessageCircle, RefreshCw, Ban, Share2 } from "lucide-react";
import jsPDF from "jspdf";

const STATUS_STYLE = {
  pagada: "bg-green-100 text-green-800",
  pendiente: "bg-zinc-100 text-zinc-700",
  vencida: "bg-red-100 text-red-800",
  "pago parcial": "bg-yellow-100 text-yellow-800",
  cancelada: "bg-blue-100 text-blue-800",
};

export default function LoanDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [payInst, setPayInst] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelAmt, setCancelAmt] = useState("");
  const [renewOpen, setRenewOpen] = useState(false);
  const [renew, setRenew] = useState({ additional_capital: 0, interest_rate: 26, installments: 30, modality: "diario", start_date: todayIso(), first_due_date: todayIso() });

  const load = async () => { const { data } = await api.get(`/loans/${id}`); setData(data); };
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="text-muted-foreground">Cargando…</div>;
  const { loan, client, installments, paid_amount, paid_count, overdue_count, pending_count, balance, payments } = data;
  const today = todayIso();

  const openPay = (inst) => {
    setPayInst(inst);
    setPayAmt(String(Math.max(0, inst.amount - inst.paid_amount)));
    setPayOpen(true);
  };

  const submitPay = async () => {
    try {
      await api.post(`/loans/${id}/pay`, {
        installment_id: payInst?.id, amount: Number(payAmt),
      });
      toast.success("Pago registrado");
      setPayOpen(false); setPayInst(null); setPayAmt(""); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const submitCancel = async () => {
    try {
      await api.post(`/loans/${id}/cancel`, { amount: Number(cancelAmt || balance) });
      toast.success("Crédito cancelado");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const submitRenew = async () => {
    try {
      const payload = { ...renew, additional_capital: Number(renew.additional_capital), interest_rate: Number(renew.interest_rate), installments: Number(renew.installments) };
      const { data: nl } = await api.post(`/loans/${id}/renew`, payload);
      toast.success("Préstamo renovado");
      window.location.href = `/prestamos/${nl.id}`;
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const lastInst = data.installments && data.installments.length > 0
    ? data.installments.reduce((m, i) => (i.number > m.number ? i : m), data.installments[0])
    : null;

  const waMessage = () => {
    const phone = (client?.whatsapp || client?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(
`*Detalle de su crédito*
Cliente: ${client?.first_name} ${client?.last_name}
Capital: ${fmtGs(loan.capital)}
Interés: ${loan.interest_rate}%
Total: ${fmtGs(loan.total)}
Cuota: ${fmtGs(loan.installment_amount)}
Modalidad: ${loan.modality}
Fecha de inicio: ${fmtDate(loan.start_date)}
Fecha estimada de cancelación: ${lastInst ? fmtDate(lastInst.due_date) : "-"}
Cuotas pagadas: ${paid_count}
Cuotas pendientes: ${pending_count}
Total abonado: ${fmtGs(paid_amount)}
Saldo pendiente: ${fmtGs(balance)}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const buildPdf = async () => {
    let settings = {};
    try {
      const { data: s } = await api.get("/settings");
      settings = s || {};
    } catch { /* ignore */ }
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text(settings.business_name || "Estado de cuenta", 15, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    const headerLine = [settings.owner_name, settings.phone && `Tel: ${settings.phone}`, settings.city].filter(Boolean).join(" · ");
    if (headerLine) { doc.text(headerLine, 15, y); y += 5; }
    doc.setDrawColor(200); doc.line(15, y, pageW - 15, y); y += 5;

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Estado de cuenta", 15, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${client.first_name} ${client.last_name}${client.alias ? ` (${client.alias})` : ""}   Código: ${client.code}`, 15, y); y += 4;
    doc.text(`Documento: ${client.document || "-"}   Tel: ${client.phone || "-"}`, 15, y); y += 6;

    const summary = [
      ["Capital", fmtGs(loan.capital)],
      ["Interés", `${loan.interest_rate}%  (${fmtGs(loan.interest)})`],
      ["Total", fmtGs(loan.total)],
      ["Cuota", `${fmtGs(loan.installment_amount)}  (${loan.modality})`],
      ["Inicio", fmtDate(loan.start_date)],
      ["Fin estimado", lastInst ? fmtDate(lastInst.due_date) : "-"],
      ["Abonado", fmtGs(paid_amount)],
      ["Saldo", fmtGs(balance)],
      ["Cuotas", `${paid_count}/${loan.installments_count} pagadas · ${pending_count} pendientes`],
    ];
    summary.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold"); doc.text(`${k}:`, 15, y);
      doc.setFont("helvetica", "normal"); doc.text(String(v), 45, y);
      y += 4.5;
    });
    y += 3;

    const today = todayIso();
    const pending = data.installments.filter((i) => i.status === "pendiente" || i.status === "pago parcial");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`Cuotas pendientes (${pending.length})`, 15, y); y += 5;
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 3.5, pageW - 30, 5, "F");
    doc.text("#", 17, y);
    doc.text("Vencimiento", 28, y);
    doc.text("Monto", 70, y);
    doc.text("Pagado", 100, y);
    doc.text("Estado", 135, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    pending.forEach((i) => {
      if (y > 275) { doc.addPage(); y = 15; }
      const status = i.status === "pendiente" && i.due_date < today ? "vencida" : i.status;
      doc.text(String(i.number), 17, y);
      doc.text(fmtDate(i.due_date), 28, y);
      doc.text(fmtGs(i.amount), 70, y);
      doc.text(fmtGs(i.paid_amount), 100, y);
      doc.text(status, 135, y);
      y += 4;
    });
    if (pending.length === 0) { doc.text("Sin cuotas pendientes.", 17, y); y += 4; }
    y += 6;

    if (settings.receipt_text) {
      doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text(settings.receipt_text, 15, y); y += 4;
    }
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString("es-PY")}`, 15, y);
    return doc;
  };

  const printReceipt = async () => {
    try {
      const doc = await buildPdf();
      doc.save(`estado-${client.code}.pdf`);
    } catch (err) {
      toast.error("No se pudo generar el PDF");
    }
  };

  const sharePdf = async () => {
    try {
      const doc = await buildPdf();
      const blob = doc.output("blob");
      const file = new File([blob], `estado-${client.code}.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Estado de cuenta",
            text: `Estado de cuenta de ${client.first_name} ${client.last_name}`,
          });
        } catch (e) { /* usuario canceló */ }
      } else {
        doc.save(`estado-${client.code}.pdf`);
        toast.info("PDF descargado, adjuntalo manualmente al chat");
      }
    } catch (err) {
      toast.error("No se pudo generar el PDF");
    }
  };

  return (
    <div className="space-y-6" data-testid="loan-detail-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="overline">Préstamo</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold"><Link to={`/clientes/${client.id}`}>{client.first_name} {client.last_name}</Link></h1>
          <div className="text-sm text-muted-foreground mt-1 font-mono">{client.code} · Inicio {fmtDate(loan.start_date)}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={waMessage} data-testid="btn-wa"><MessageCircle size={16} className="mr-1"/>WhatsApp</Button>
          <Button variant="outline" onClick={printReceipt} data-testid="btn-print"><FileText size={16} className="mr-1"/>PDF</Button>
          <Button variant="outline" onClick={sharePdf} data-testid="btn-share"><Share2 size={16} className="mr-1"/>Compartir</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Capital</div><div className="kpi-value text-2xl mt-1">{fmtGs(loan.capital)}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Total</div><div className="kpi-value text-2xl mt-1">{fmtGs(loan.total)}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Abonado</div><div className="kpi-value text-2xl mt-1 text-primary">{fmtGs(paid_amount)}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Saldo</div><div className="kpi-value text-2xl mt-1 text-accent">{fmtGs(balance)}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Cuota</div><div className="kpi-value text-2xl mt-1">{fmtGs(loan.installment_amount)}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Pagadas</div><div className="kpi-value text-2xl mt-1">{paid_count}/{loan.installments_count}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Pendientes</div><div className="kpi-value text-2xl mt-1">{pending_count}</div></div>
        <div className="bg-white border border-border rounded-md p-4"><div className="overline">Vencidas</div><div className="kpi-value text-2xl mt-1 text-accent">{overdue_count}</div></div>
      </div>

      {loan.status === "activo" && (
        <div className="flex flex-wrap gap-2">
          <Button className="h-12 flex-1 md:flex-none" onClick={() => openPay({ id: null, amount: loan.installment_amount, paid_amount: 0 })} data-testid="btn-cobrar">
            <HandCoins size={18} className="mr-2"/> COBRAR CUOTA
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="h-12" data-testid="btn-cancel-loan"><Ban size={16} className="mr-1"/>Cancelar cuotas restantes</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar cuotas restantes</AlertDialogTitle>
                <AlertDialogDescription>
                  Saldo pendiente: <b>{fmtGs(balance)}</b>. Ingresá el monto real de cancelación (podés descontar intereses).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input type="number" placeholder={String(balance)} value={cancelAmt} onChange={(e) => setCancelAmt(e.target.value)} data-testid="cancel-amount" />
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction onClick={submitCancel} data-testid="confirm-cancel">Confirmar cancelación</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
            <DialogTrigger asChild><Button variant="outline" className="h-12" data-testid="btn-renew"><RefreshCw size={16} className="mr-1"/>Renovar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Renovar crédito</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="text-sm">Saldo pendiente: <b>{fmtGs(balance)}</b></div>
                <div><Label>Capital adicional</Label><Input type="number" value={renew.additional_capital} onChange={(e) => setRenew({ ...renew, additional_capital: e.target.value })} data-testid="renew-add" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Interés %</Label><Input type="number" value={renew.interest_rate} onChange={(e) => setRenew({ ...renew, interest_rate: e.target.value })} /></div>
                  <div><Label>Cuotas</Label><Input type="number" value={renew.installments} onChange={(e) => setRenew({ ...renew, installments: e.target.value })} /></div>
                </div>
                <div><Label>Modalidad</Label>
                  <Select value={renew.modality} onValueChange={(v) => setRenew({ ...renew, modality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MODALITIES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Entrega</Label><Input type="date" value={renew.start_date} onChange={(e) => setRenew({ ...renew, start_date: e.target.value })} /></div>
                  <div><Label>Primer venc.</Label><Input type="date" value={renew.first_due_date} onChange={(e) => setRenew({ ...renew, first_due_date: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setRenewOpen(false)}>Cancelar</Button><Button onClick={submitRenew} data-testid="confirm-renew">Confirmar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <div className="p-4 border-b border-border overline">Cronograma de cuotas</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr><th className="p-2">#</th><th className="p-2">Vencimiento</th><th className="p-2 text-right">Monto</th><th className="p-2 text-right">Pagado</th><th className="p-2">Estado</th><th className="p-2">Acción</th></tr>
            </thead>
            <tbody>
              {installments.map((i) => {
                const isOverdue = i.status !== "pagada" && i.status !== "cancelada" && i.due_date < today;
                const label = isOverdue && i.status !== "pago parcial" ? "vencida" : i.status;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-2">{i.number}</td>
                    <td className="p-2">{fmtDate(i.due_date)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtGs(i.amount)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtGs(i.paid_amount)}</td>
                    <td className="p-2"><Badge className={STATUS_STYLE[label] || ""}>{label}</Badge></td>
                    <td className="p-2">{loan.status === "activo" && i.status !== "pagada" && i.status !== "cancelada" && (
                      <Button size="sm" variant="outline" onClick={() => openPay(i)} data-testid={`pay-inst-${i.number}`}>Cobrar</Button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar cobro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {payInst?.number && <div className="text-sm">Cuota #{payInst.number} · Monto sugerido: <b>{fmtGs(payInst.amount - payInst.paid_amount)}</b></div>}
            <div><Label>Importe recibido</Label><Input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} data-testid="pay-amount" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button><Button onClick={submitPay} data-testid="confirm-pay">Confirmar cobro</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {payments.length > 0 && (
        <div className="bg-white border border-border rounded-md overflow-hidden">
          <div className="p-4 border-b border-border overline">Historial de pagos</div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left"><tr><th className="p-2">Fecha</th><th className="p-2">Tipo</th><th className="p-2 text-right">Monto</th></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.id} className="border-t border-border"><td className="p-2">{new Date(p.created_at).toLocaleString("es-PY")}</td><td className="p-2 capitalize">{p.type}</td><td className="p-2 text-right tabular-nums">{fmtGs(p.amount)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
