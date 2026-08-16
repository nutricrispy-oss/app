import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, Plus, Download } from "lucide-react";
import { fmtDate, todayIso } from "@/lib/format";

export default function Settings() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ business_name: "", owner_name: "", phone: "", whatsapp: "", address: "", city: "", currency: "Gs.", receipt_text: "", holidays: [] });
  const [newHoliday, setNewHoliday] = useState("");
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setForm((f) => ({ ...f, ...r.data, holidays: r.data.holidays || [] })));
    api.get("/auth/me").then((r) => setProfile({ name: r.data.name || "", email: r.data.email || "" }));
  }, []);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setLoading(true);
    try {
      await api.put("/settings", form);
      toast.success("Configuración guardada");
      await refreshUser();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const addHoliday = () => {
    if (!newHoliday || form.holidays.includes(newHoliday)) return;
    setForm({ ...form, holidays: [...form.holidays, newHoliday].sort() });
    setNewHoliday("");
  };
  const removeHoliday = (h) => setForm({ ...form, holidays: form.holidays.filter((x) => x !== h) });

  const saveProfile = async () => {
    try {
      await api.put("/auth/profile", profile);
      toast.success("Datos de cuenta actualizados");
      await refreshUser();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const changePw = async () => {
    if (!pw.current_password) { toast.error("Ingresá la contraseña actual"); return; }
    if (!pw.new_password) { toast.error("La nueva contraseña no puede estar vacía"); return; }
    if (pw.new_password !== pw.confirm) { toast.error("Las contraseñas nuevas no coinciden"); return; }
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      toast.success("Contraseña cambiada");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const downloadBackup = async () => {
    try {
      const res = await api.get("/backup", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${todayIso()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Copia de seguridad descargada");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div><div className="overline">Preferencias</div><h1 className="font-display text-3xl md:text-4xl font-bold">Configuración</h1></div>

      {/* Negocio */}
      <section className="bg-white border border-border rounded-md p-5 space-y-5">
        <div className="overline">Datos del negocio</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nombre comercial</Label><Input data-testid="cfg-business" value={form.business_name} onChange={upd("business_name")} /></div>
          <div><Label>Nombre del propietario</Label><Input data-testid="cfg-owner" value={form.owner_name} onChange={upd("owner_name")} /></div>
          <div><Label>Teléfono</Label><Input value={form.phone} onChange={upd("phone")} /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={upd("whatsapp")} /></div>
          <div><Label>Ciudad</Label><Input value={form.city} onChange={upd("city")} /></div>
          <div><Label>Moneda</Label><Input value={form.currency} onChange={upd("currency")} /></div>
          <div className="md:col-span-2"><Label>Dirección</Label><Input value={form.address} onChange={upd("address")} /></div>
          <div className="md:col-span-2"><Label>Texto personalizado para recibos</Label><Textarea rows={3} value={form.receipt_text} onChange={upd("receipt_text")} /></div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="overline mb-2">Feriados (días no cobrables)</div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} data-testid="cfg-new-holiday" className="max-w-xs" />
            <Button variant="outline" onClick={addHoliday} data-testid="btn-add-holiday" disabled={!newHoliday}><Plus size={16} className="mr-1" />Agregar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.holidays.length === 0 && <div className="text-sm text-muted-foreground">Sin feriados cargados.</div>}
            {form.holidays.map((h) => (
              <div key={h} className="flex items-center gap-2 bg-secondary rounded-md px-3 py-1 text-sm" data-testid={`holiday-${h}`}>
                <span>{fmtDate(h)}</span>
                <button onClick={() => removeHoliday(h)} data-testid={`btn-remove-holiday-${h}`} className="text-muted-foreground hover:text-accent"><X size={14} /></button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Al guardar, las cuotas pendientes que caigan en un feriado nuevo se corren automáticamente al siguiente día hábil.</p>
        </div>

        <Button onClick={save} disabled={loading} data-testid="btn-save-settings">Guardar cambios</Button>
      </section>

      {/* Mi cuenta */}
      <section className="bg-white border border-border rounded-md p-5 space-y-5">
        <div className="overline">Mi cuenta</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nombre</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} data-testid="cfg-account-name" /></div>
          <div><Label>Email</Label><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} data-testid="cfg-account-email" /></div>
        </div>
        <Button onClick={saveProfile} data-testid="btn-save-profile">Guardar datos de cuenta</Button>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="overline">Cambiar contraseña</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Contraseña actual</Label><Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} data-testid="cfg-pw-current" /></div>
            <div><Label>Nueva contraseña</Label><Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="cfg-pw-new" /></div>
            <div><Label>Confirmar nueva</Label><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} data-testid="cfg-pw-confirm" /></div>
          </div>
          <Button onClick={changePw} data-testid="btn-change-pw">Cambiar contraseña</Button>
        </div>
      </section>

      {/* Backup */}
      <section className="bg-white border border-border rounded-md p-5 space-y-3">
        <div className="overline">Respaldo de datos</div>
        <p className="text-sm text-muted-foreground">Descargá un archivo JSON con todos tus clientes, préstamos, cuotas y pagos. Guardalo en un lugar seguro.</p>
        <Button onClick={downloadBackup} data-testid="btn-backup"><Download size={16} className="mr-1" />Descargar copia de seguridad</Button>
      </section>
    </div>
  );
}
