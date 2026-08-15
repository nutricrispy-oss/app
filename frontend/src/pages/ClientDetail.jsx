import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { fmtGs, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  activo: "bg-primary/10 text-primary",
  cancelado: "bg-green-100 text-green-800",
  cancelado_anticipado: "bg-blue-100 text-blue-800",
  renovado: "bg-purple-100 text-purple-800",
};

const EDIT_EMPTY = { first_name: "", last_name: "", alias: "", document: "", phone: "", whatsapp: "", address: "", city: "", workplace: "", reference_name: "", reference_phone: "", notes: "" };

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(EDIT_EMPTY);

  const load = async () => {
    const { data } = await api.get(`/clients/${id}`);
    setData(data);
    setEditForm({ ...EDIT_EMPTY, ...data.client });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const upd = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const saveEdit = async () => {
    try {
      await api.put(`/clients/${id}`, editForm);
      toast.success("Cliente actualizado");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  if (!data) return <div className="text-muted-foreground">Cargando…</div>;
  const { client, loans } = data;

  return (
    <div className="space-y-6" data-testid="client-detail-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="overline">Cliente {client.code}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {client.first_name} {client.last_name}
            {client.alias ? <span className="text-muted-foreground font-normal"> ({client.alias})</span> : null}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">{client.document || "-"} · {client.phone || "-"} · {client.city || "-"}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="btn-edit-client"><Pencil size={16} className="mr-1" /> Editar cliente</Button>
          <Link to={`/prestamos/nuevo?client=${client.id}`}>
            <Button data-testid="btn-new-loan-client"><Plus size={16} className="mr-1" /> Nuevo préstamo</Button>
          </Link>
        </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nombre *</Label><Input data-testid="e-first" value={editForm.first_name} onChange={upd("first_name")} /></div>
            <div><Label>Apellido *</Label><Input data-testid="e-last" value={editForm.last_name} onChange={upd("last_name")} /></div>
            <div><Label>Alias / Sobrenombre</Label><Input data-testid="e-alias" value={editForm.alias} onChange={upd("alias")} /></div>
            <div><Label>Documento</Label><Input data-testid="e-doc" value={editForm.document} onChange={upd("document")} /></div>
            <div><Label>Teléfono</Label><Input data-testid="e-phone" value={editForm.phone} onChange={upd("phone")} /></div>
            <div><Label>WhatsApp</Label><Input data-testid="e-wa" value={editForm.whatsapp} onChange={upd("whatsapp")} /></div>
            <div><Label>Ciudad</Label><Input data-testid="e-city" value={editForm.city} onChange={upd("city")} /></div>
            <div className="md:col-span-2"><Label>Dirección</Label><Input data-testid="e-addr" value={editForm.address} onChange={upd("address")} /></div>
            <div><Label>Lugar de trabajo</Label><Input value={editForm.workplace} onChange={upd("workplace")} /></div>
            <div><Label>Referencia</Label><Input value={editForm.reference_name} onChange={upd("reference_name")} /></div>
            <div><Label>Tel. referencia</Label><Input value={editForm.reference_phone} onChange={upd("reference_phone")} /></div>
            <div className="md:col-span-2"><Label>Observaciones</Label><Input value={editForm.notes} onChange={upd("notes")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} data-testid="btn-save-edit-client" disabled={!editForm.first_name || !editForm.last_name}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
