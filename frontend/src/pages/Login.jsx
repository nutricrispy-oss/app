import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenido de vuelta");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Error al iniciar sesión");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      <div className="hidden md:block relative">
        <img src="https://images.unsplash.com/photo-1614595737476-42487331b8a1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwyfHxtaW5pbWFsaXN0JTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmd8ZW58MHx8fHwxNzg2NjY1NTM4fDA&ixlib=rb-4.1.0&q=85"
          alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="relative z-10 p-10 h-full flex flex-col justify-between text-white">
          <div className="overline text-white/80">Gestión Financiera</div>
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold leading-none">Control total<br/>de tus préstamos.</h1>
            <p className="mt-3 text-white/85 max-w-sm">Clientes, cuotas, cobros, caja y reportes — todo en un solo sistema profesional.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div>
            <div className="overline">Iniciar sesión</div>
            <h2 className="font-display text-3xl font-bold mt-1">Accedé a tu sistema</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" data-testid="login-email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" data-testid="login-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" data-testid="login-submit" className="w-full h-11" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
          <div className="flex justify-between text-sm">
            <Link to="/forgot-password" data-testid="link-forgot" className="text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            <Link to="/register" data-testid="link-register" className="text-primary hover:underline">Crear cuenta</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
