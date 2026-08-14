import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const token = sp.get("token") || "";

  const onSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Contraseña restablecida");
      nav("/login");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-md border border-border">
        <h2 className="font-display text-3xl font-bold">Nueva contraseña</h2>
        <div className="space-y-2">
          <Label>Contraseña nueva</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading || !token}>Guardar</Button>
        <div className="text-sm text-center"><Link to="/login" className="text-primary hover:underline">Volver</Link></div>
      </form>
    </div>
  );
}
