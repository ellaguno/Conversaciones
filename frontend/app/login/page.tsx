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
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if Google OAuth is configured
    fetch('/api/auth/providers-info')
      .then((r) => r.json())
      .then((data) => setGoogleAvailable(data.google === true))
      .catch(() => {});

    // Check if guest mode is enabled
    fetch('/api/auth/guest-config')
      .then((r) => r.json())
      .then((data) => setGuestEnabled(data.guestEnabled === true))
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
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <img
            src="/logo_transparente.png"
            alt="Conversaciones"
            className="h-32 w-auto object-contain"
          />
        </div>

        {/* Guest mode: prominent "try without account" button */}
        {guestEnabled && (
          <div className="space-y-3">
            <Link
              href="/"
              className="bg-primary text-primary-foreground flex w-full items-center justify-center rounded-full px-6 py-3 font-mono text-xs font-bold uppercase shadow-md transition-transform hover:scale-[1.02]"
            >
              Probar sin cuenta
            </Link>
            <div className="flex items-center gap-3">
              <div className="border-border flex-1 border-t" />
              <span className="text-muted-foreground text-xs">o inicia sesion</span>
              <div className="border-border flex-1 border-t" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!guestEnabled && (
            <h1 className="text-foreground text-center text-xl font-bold">Iniciar sesion</h1>
          )}

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
            className={`w-full rounded-full font-mono text-xs font-bold uppercase ${guestEnabled ? 'bg-foreground/10 text-foreground hover:bg-foreground/20' : ''}`}
            variant={guestEnabled ? 'outline' : 'default'}
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

        {/* Invite button */}
        {!showInvite ? (
          <button
            onClick={() => setShowInvite(true)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 text-xs transition-colors hover:underline"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Invitar a alguien
          </button>
        ) : (
          <div className="border-border bg-background w-full rounded-xl border p-4 shadow-sm">
            <p className="text-foreground mb-2 text-center text-xs font-medium">
              Enviar invitacion por correo
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-full border px-3 py-1.5 text-xs focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!inviteEmail.includes('@')) return;
                  setInviteStatus('sending');
                  try {
                    const res = await fetch('/api/invite', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: inviteEmail }),
                    });
                    if (!res.ok) throw new Error();
                    setInviteStatus('sent');
                    setTimeout(() => {
                      setShowInvite(false);
                      setInviteEmail('');
                      setInviteStatus('');
                    }, 2000);
                  } catch {
                    setInviteStatus('error');
                  }
                }}
                disabled={inviteStatus === 'sending' || !inviteEmail.includes('@')}
                className="bg-primary text-primary-foreground shrink-0 rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                {inviteStatus === 'sending' ? '...' : 'Enviar'}
              </button>
            </div>
            {inviteStatus === 'sent' && (
              <p className="mt-2 text-center text-xs text-green-600">Invitacion enviada</p>
            )}
            {inviteStatus === 'error' && (
              <p className="mt-2 text-center text-xs text-red-500">Error al enviar</p>
            )}
            <button
              onClick={() => {
                setShowInvite(false);
                setInviteStatus('');
              }}
              className="text-muted-foreground mt-2 w-full text-center text-[10px] hover:underline"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
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
