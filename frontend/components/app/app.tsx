'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut, useSession as useAuthSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { SettingsView } from '@/components/app/settings-view';
import { ViewController } from '@/components/app/view-controller';
import type { TherapyOptions } from '@/components/app/welcome-view';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import {
  type PersonalityConfig,
  getConfig,
  loadConfigs,
  saveConfigs,
} from '@/lib/personalities-config';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface AppProps {
  appConfig: AppConfig;
  initialPersonality?: string;
  initialPatientId?: string;
}

function GuestTimerBanner({
  minutesLeft,
  secondsLeft,
}: {
  minutesLeft: number;
  secondsLeft: number;
}) {
  const isUrgent = minutesLeft < 2;
  return (
    <div
      className={`fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-1.5 font-mono text-xs font-bold shadow-lg ${
        isUrgent
          ? 'animate-pulse bg-red-600 text-white'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'
      }`}
    >
      {minutesLeft}:{secondsLeft.toString().padStart(2, '0')} restantes
      <span className="ml-2 font-normal">
        &middot;{' '}
        <Link href="/register" className="underline">
          Registrate
        </Link>{' '}
        para tiempo ilimitado
      </span>
    </div>
  );
}

function SessionInner({
  appConfig,
  personality,
  patientId,
  autoConnect,
  selectedPersonality,
  onSelectPersonality,
  onStartCall,
  onDisconnected,
  personalityConfig,
  onOpenSettings,
  onLogout,
  onAdminPanel,
  isAdmin,
  therapyMethod,
  coupleTherapy,
  initialPatientId,
  isGuest,
  guestMinutes,
  onGuestExpired,
}: {
  appConfig: AppConfig;
  personality: string;
  patientId: string;
  autoConnect: boolean;
  selectedPersonality: string;
  onSelectPersonality: (p: string) => void;
  onStartCall: (p: string, patientId?: string, therapy?: TherapyOptions) => void;
  onDisconnected: () => void;
  personalityConfig: PersonalityConfig;
  onOpenSettings: () => void;
  onLogout: () => void;
  onAdminPanel?: () => void;
  isAdmin: boolean;
  therapyMethod: string;
  coupleTherapy: boolean;
  initialPatientId?: string;
  isGuest: boolean;
  guestMinutes: number;
  onGuestExpired: () => void;
}) {
  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality,
          patientId,
          voiceId: personalityConfig.voiceId,
          temperature: personalityConfig.temperature,
          model: personalityConfig.model,
          ...(therapyMethod && { therapyMethod }),
          ...(coupleTherapy && { coupleTherapy }),
        }),
      });
      if (!res.ok) {
        throw new Error(`Token error: ${res.status}`);
      }
      return await res.json();
    });
  }, [
    personality,
    patientId,
    personalityConfig.voiceId,
    personalityConfig.temperature,
    personalityConfig.model,
    therapyMethod,
    coupleTherapy,
  ]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  // Guest timer
  const [remaining, setRemaining] = useState(guestMinutes * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isGuest) return;
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onGuestExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGuest, onGuestExpired]);

  const minutesLeft = Math.floor(remaining / 60);
  const secondsLeft = remaining % 60;

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      {isGuest && <GuestTimerBanner minutesLeft={minutesLeft} secondsLeft={secondsLeft} />}
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          selectedPersonality={selectedPersonality}
          activePersonality={personality}
          onSelectPersonality={onSelectPersonality}
          onStartCall={onStartCall}
          autoConnect={autoConnect}
          onDisconnected={onDisconnected}
          personalityConfig={personalityConfig}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
          onAdminPanel={onAdminPanel}
          isAdmin={isAdmin}
          initialPatientId={initialPatientId}
          isGuest={isGuest}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{ warning: <WarningIcon weight="bold" /> }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}

function GuestExpiredView() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="text-5xl">⏱️</div>
        <h1 className="text-foreground text-xl font-bold">Tiempo de prueba terminado</h1>
        <p className="text-muted-foreground text-sm">
          Crea una cuenta gratuita para continuar con conversaciones ilimitadas, guardar tu
          historial y acceder a todas las funciones.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/register"
            className="bg-primary text-primary-foreground inline-block rounded-full px-6 py-2.5 font-mono text-xs font-bold uppercase"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}

export function App({ appConfig, initialPersonality, initialPatientId }: AppProps) {
  const { data: authSession, status: authStatus } = useAuthSession();
  const router = useRouter();
  const isLoggedIn = !!authSession?.user;
  const isAdmin = (authSession?.user as { role?: string } | undefined)?.role === 'admin';
  const [selectedPersonality, setSelectedPersonality] = useState(initialPersonality || 'trader');
  const [activePersonality, setActivePersonality] = useState(initialPersonality || 'trader');
  const [activePatientId, setActivePatientId] = useState('');
  const [sessionId, setSessionId] = useState(0);
  const [autoConnect, setAutoConnect] = useState(false);
  const [configs, setConfigs] = useState<Record<string, PersonalityConfig>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [activeTherapyMethod, setActiveTherapyMethod] = useState('');
  const [activeCoupleTherapy, setActiveCoupleTherapy] = useState(false);

  // Guest mode state
  const [guestConfig, setGuestConfig] = useState<{
    guestEnabled: boolean;
    guestMinutes: number;
  } | null>(null);
  const [guestExpired, setGuestExpired] = useState(false);

  useEffect(() => {
    setConfigs(loadConfigs());
    // Fetch guest config
    fetch('/api/auth/guest-config')
      .then((r) => r.json())
      .then(setGuestConfig)
      .catch(() => setGuestConfig({ guestEnabled: false, guestMinutes: 10 }));
  }, []);

  const isGuest = !isLoggedIn && guestConfig?.guestEnabled === true;

  // If not logged in, not guest, and auth is resolved → redirect to login
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isLoggedIn && guestConfig !== null && !guestConfig.guestEnabled) {
      router.push('/login');
    }
  }, [authStatus, isLoggedIn, guestConfig, router]);

  const handleStartCall = useCallback(
    (personality: string, patientId?: string, therapy?: TherapyOptions) => {
      setSelectedPersonality(personality);
      setActivePersonality(personality);
      setActivePatientId(patientId || '');
      setActiveTherapyMethod(therapy?.therapyMethod || '');
      setActiveCoupleTherapy(therapy?.coupleTherapy || false);
      setAutoConnect(true);
      setSessionId((prev) => prev + 1);
    },
    []
  );

  const handleDisconnected = useCallback(() => {
    setAutoConnect(false);
  }, []);

  const handleSaveConfigs = useCallback((newConfigs: Record<string, PersonalityConfig>) => {
    setConfigs(newConfigs);
    saveConfigs(newConfigs);
  }, []);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  const handleGuestExpired = useCallback(() => {
    setGuestExpired(true);
    setAutoConnect(false);
  }, []);

  // Loading state
  if (authStatus === 'loading' || guestConfig === null) {
    return null;
  }

  // Guest expired
  if (guestExpired) {
    return <GuestExpiredView />;
  }

  // Not logged in and guest not enabled — will redirect via useEffect
  if (!isLoggedIn && !isGuest) {
    return null;
  }

  if (showSettings && !isGuest) {
    return (
      <SettingsView
        configs={configs}
        onSave={handleSaveConfigs}
        onBack={() => setShowSettings(false)}
        isAdmin={isAdmin}
      />
    );
  }

  const activeConfig = getConfig(configs, activePersonality);

  return (
    <SessionInner
      key={sessionId}
      appConfig={appConfig}
      personality={activePersonality}
      patientId={activePatientId}
      autoConnect={autoConnect}
      selectedPersonality={selectedPersonality}
      onSelectPersonality={setSelectedPersonality}
      onStartCall={handleStartCall}
      onDisconnected={handleDisconnected}
      personalityConfig={activeConfig}
      onOpenSettings={() => setShowSettings(true)}
      onLogout={handleLogout}
      onAdminPanel={() => router.push('/admin')}
      isAdmin={isAdmin}
      therapyMethod={activeTherapyMethod}
      coupleTherapy={activeCoupleTherapy}
      initialPatientId={initialPatientId}
      isGuest={isGuest}
      guestMinutes={guestConfig?.guestMinutes || 10}
      onGuestExpired={handleGuestExpired}
    />
  );
}
