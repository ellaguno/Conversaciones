'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error');
      } else {
        setSent(true);
      }
    } catch {
      setError('Error de conexion');
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">📧</div>
          <h1 className="text-foreground text-xl font-bold">Correo enviado</h1>
          <p className="text-muted-foreground text-sm">
            Si existe una cuenta con ese usuario o correo, recibiras un enlace para restablecer tu
            contraseña.
          </p>
          <Link href="/login" className="text-primary text-sm hover:underline">
            Volver al inicio de sesion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-foreground text-center text-xl font-bold">Recuperar contraseña</h1>
        <p className="text-muted-foreground text-center text-sm">
          Ingresa tu nombre de usuario o correo electronico.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Usuario o correo electronico"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full font-mono text-xs font-bold uppercase"
        >
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          <Link href="/login" className="text-primary hover:underline">
            Volver al inicio de sesion
          </Link>
        </p>
      </form>
    </div>
  );
}
