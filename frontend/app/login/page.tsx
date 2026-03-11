'use client';

import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if Google OAuth is configured
    fetch('/api/auth/providers-info')
      .then((r) => r.json())
      .then((data) => setGoogleAvailable(data.google === true))
      .catch(() => {});

    // Show pending account message
    if (searchParams.get('error') === 'pending') {
      setError('Tu cuenta esta pendiente de aprobacion por un administrador.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // Check if the account might be pending
      try {
        const res = await fetch('/api/auth/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (data.status === 'pending') {
          setError('Tu cuenta esta pendiente de aprobacion por un administrador.');
          return;
        }
        if (data.status === 'rejected') {
          setError('Tu solicitud de cuenta fue rechazada. Contacta al administrador.');
          return;
        }
      } catch {}
      setError('Usuario o contraseña incorrectos');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-foreground text-center text-xl font-bold">Iniciar sesion</h1>

        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full font-mono text-xs font-bold uppercase"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>

        {googleAvailable && (
          <>
            <div className="flex items-center gap-3">
              <div className="border-border flex-1 border-t" />
              <span className="text-muted-foreground text-xs">o</span>
              <div className="border-border flex-1 border-t" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              className="w-full rounded-full text-xs font-medium"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </Button>
          </>
        )}

        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="text-primary text-xs hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <Link href="/register" className="text-primary text-xs hover:underline">
            Crear cuenta
          </Link>
        </div>
      </form>
      <span className="text-muted-foreground absolute right-4 bottom-3 text-[10px]">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-svh items-center justify-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
