'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<false | 'pending' | 'active'>(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al registrar');
      } else if (data.requireApproval) {
        setSuccess('pending');
      } else {
        setSuccess('active');
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
          <h1 className="text-foreground text-xl font-bold">
            {success === 'pending' ? 'Registro enviado' : 'Cuenta creada'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {success === 'pending'
              ? 'Tu solicitud ha sido enviada. Un administrador revisara tu cuenta y recibiras un correo cuando sea aprobada.'
              : 'Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesion.'}
          </p>
          <Button
            onClick={() => router.push('/login')}
            variant="outline"
            className="rounded-full text-xs"
          >
            {success === 'pending' ? 'Volver al inicio de sesion' : 'Iniciar sesion'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-foreground text-center text-xl font-bold">Crear cuenta</h1>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          title="Solo letras, numeros y guion bajo"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Nombre completo"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electronico"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (minimo 6 caracteres)"
          required
          minLength={6}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar contraseña"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full font-mono text-xs font-bold uppercase"
        >
          {loading ? 'Registrando...' : 'Crear cuenta'}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </form>
      <span className="text-muted-foreground absolute right-4 bottom-3 text-[10px]">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </span>
    </div>
  );
}
