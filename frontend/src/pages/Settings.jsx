import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function Settings() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ business_name: "", owner_name: "", phone: "", whatsapp: "", address: "", city: "", currency: "Gs.", receipt_text: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setForm({ ...form, ...r.data })); /* eslint-disable-next-line */ }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setLoading(true);
    try { await api.put("/settings", form); toast.success("Configuración guardada"); await refreshUser(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl" data-testid="settings-page">
      <div><div className="overline">Preferencias</div><h1 className="font-display text-3xl md:text-4xl font-bold">Configuración del prestamista</h1></div>
      <div className="bg-white border border-border rounded-md p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Nombre comercial</Label><Input data-testid="cfg-business" value={form.business_name} onChange={upd("business_name")} /></div>
        <div><Label>Nombre del propietario</Label><Input data-testid="cfg-owner" value={form.owner_name} onChange={upd("owner_name")} /></div>
        <div><Label>Teléfono</Label><Input value={form.phone} onChange={upd("phone")} /></div>
        <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={upd("whatsapp")} /></div>
        <div><Label>Ciudad</Label><Input value={form.city} onChange={upd("city")} /></div>
        <div><Label>Moneda</Label><Input value={form.currency} onChange={upd("currency")} /></div>
        <div className="md:col-span-2"><Label>Dirección</Label><Input value={form.address} onChange={upd("address")} /></div>
        <div className="md:col-span-2"><Label>Texto personalizado para recibos</Label><Textarea rows={3} value={form.receipt_text} onChange={upd("receipt_text")} /></div>
      </div>
      <Button onClick={save} disabled={loading} data-testid="btn-save-settings">Guardar cambios</Button>
    </div>
  );
}
