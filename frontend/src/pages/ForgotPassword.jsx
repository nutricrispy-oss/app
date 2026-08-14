import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Si el correo existe, se enviaron instrucciones");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-md border border-border">
        <div>
          <div className="overline">Recuperación</div>
          <h2 className="font-display text-3xl font-bold mt-1">Restablecer contraseña</h2>
          <p className="text-sm text-muted-foreground mt-2">Ingresá tu correo. Te enviaremos un enlace para restablecer tu contraseña.</p>
        </div>
        {sent ? (
          <div className="p-3 rounded-md bg-secondary text-sm">Revisa tu correo. El enlace también quedó registrado en los logs del servidor.</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input data-testid="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" data-testid="forgot-submit" className="w-full h-11" disabled={loading}>Enviar enlace</Button>
          </>
        )}
        <div className="text-sm text-center">
          <Link to="/login" className="text-primary hover:underline">Volver al inicio de sesión</Link>
        </div>
      </form>
    </div>
  );
}
