'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-foreground text-xl font-bold">Enlace invalido</h1>
          <p className="text-muted-foreground text-sm">
            Este enlace de restablecimiento no es valido o ha expirado.
          </p>
          <a href="/login" className="text-primary text-sm hover:underline">
            Ir al inicio de sesion
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Error de conexion');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="text-foreground text-xl font-bold">Contraseña cambiada</h1>
          <p className="text-muted-foreground text-sm">
            Tu contraseña ha sido restablecida. Ya puedes iniciar sesion.
          </p>
          <Button
            onClick={() => router.push('/login')}
            className="rounded-full font-mono text-xs font-bold uppercase"
          >
            Iniciar sesion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-foreground text-center text-xl font-bold">Nueva contraseña</h1>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña (minimo 6 caracteres)"
          required
          minLength={6}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar nueva contraseña"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full font-mono text-xs font-bold uppercase"
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-svh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
