import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", business_name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await register(form);
      toast.success("Cuenta creada");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-md border border-border" data-testid="register-form">
        <div>
          <div className="overline">Nueva cuenta</div>
          <h2 className="font-display text-3xl font-bold mt-1">Registro</h2>
        </div>
        <div className="space-y-2">
          <Label>Nombre del propietario</Label>
          <Input data-testid="reg-name" value={form.name} onChange={upd("name")} required />
        </div>
        <div className="space-y-2">
          <Label>Nombre comercial (opcional)</Label>
          <Input data-testid="reg-business" value={form.business_name} onChange={upd("business_name")} />
        </div>
        <div className="space-y-2">
          <Label>Correo electrónico</Label>
          <Input data-testid="reg-email" type="email" value={form.email} onChange={upd("email")} required />
        </div>
        <div className="space-y-2">
          <Label>Contraseña</Label>
          <Input data-testid="reg-password" type="password" value={form.password} onChange={upd("password")} required minLength={6} />
        </div>
        <Button type="submit" data-testid="reg-submit" className="w-full h-11" disabled={loading}>
          {loading ? "Creando…" : "Crear cuenta"}
        </Button>
        <div className="text-sm text-center">
          ¿Ya tenés cuenta? <Link to="/login" className="text-primary hover:underline">Iniciar sesión</Link>
        </div>
      </form>
    </div>
  );
}
