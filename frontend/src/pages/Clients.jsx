import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus } from "lucide-react";
import { fmtDate } from "@/lib/format";

const EMPTY = { first_name: "", last_name: "", alias: "", document: "", phone: "", whatsapp: "", address: "", city: "", workplace: "", reference_name: "", reference_phone: "", notes: "" };

export default function Clients() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const { data } = await api.get("/clients", { params: q ? { q } : {} });
    setItems(data);
  };
  useEffect(() => { load(); }, [q]);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    try {
      await api.post("/clients", form);
      toast.success("Cliente creado");
      setOpen(false); setForm(EMPTY); load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-4" data-testid="clients-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="overline">Cartera</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Clientes</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-client"><Plus size={16} className="mr-1" /> Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input data-testid="c-first" value={form.first_name} onChange={upd("first_name")} /></div>
              <div><Label>Apellido *</Label><Input data-testid="c-last" value={form.last_name} onChange={upd("last_name")} /></div>
              <div><Label>Alias / Sobrenombre</Label><Input data-testid="c-alias" value={form.alias} onChange={upd("alias")} /></div>
              <div><Label>Documento</Label><Input data-testid="c-doc" value={form.document} onChange={upd("document")} /></div>
              <div><Label>Teléfono</Label><Input data-testid="c-phone" value={form.phone} onChange={upd("phone")} /></div>
              <div><Label>WhatsApp</Label><Input data-testid="c-wa" value={form.whatsapp} onChange={upd("whatsapp")} placeholder="Ej: 595981..." /></div>
              <div><Label>Ciudad</Label><Input data-testid="c-city" value={form.city} onChange={upd("city")} /></div>
              <div className="md:col-span-2"><Label>Dirección</Label><Input data-testid="c-addr" value={form.address} onChange={upd("address")} /></div>
              <div><Label>Lugar de trabajo</Label><Input value={form.workplace} onChange={upd("workplace")} /></div>
              <div><Label>Referencia</Label><Input value={form.reference_name} onChange={upd("reference_name")} /></div>
              <div><Label>Tel. referencia</Label><Input value={form.reference_phone} onChange={upd("reference_phone")} /></div>
              <div className="md:col-span-2"><Label>Observaciones</Label><Input value={form.notes} onChange={upd("notes")} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} data-testid="btn-save-client" disabled={!form.first_name || !form.last_name}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <Input data-testid="client-search" className="pl-9" placeholder="Buscar por nombre, documento, teléfono o código..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="bg-white border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-left">
              <th className="p-3">Código</th>
              <th className="p-3">Nombre</th>
              <th className="p-3 hidden md:table-cell">Documento</th>
              <th className="p-3 hidden md:table-cell">Teléfono</th>
              <th className="p-3 hidden lg:table-cell">Ciudad</th>
              <th className="p-3 hidden lg:table-cell">Registro</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={6}>Sin clientes aún.</td></tr>}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-secondary/40 cursor-pointer" data-testid={`row-client-${c.code}`}>
                <td className="p-3 font-mono">{c.code}</td>
                <td className="p-3"><Link className="text-primary font-medium" to={`/clientes/${c.id}`}>{c.first_name} {c.last_name}</Link></td>
                <td className="p-3 hidden md:table-cell">{c.document || "-"}</td>
                <td className="p-3 hidden md:table-cell">{c.phone || "-"}</td>
                <td className="p-3 hidden lg:table-cell">{c.city || "-"}</td>
                <td className="p-3 hidden lg:table-cell">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
