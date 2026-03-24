'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RoomEvent } from 'livekit-client';
import { TokenSource } from 'livekit-client';
import { useRoomContext, useSession, useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { Toaster } from '@/components/ui/sonner';
import { getConfig, loadConfigs } from '@/lib/personalities-config';

// ── Types ───────────────────────────────────────────────────────────────

type DemoMode = 'vendedor' | 'cliente';
type InsuranceType = 'vida' | 'gastos';
type SellerProfile = 'agresivo' | 'asertivo' | 'pasivo';
type ClientProfile = 'facil' | 'normal' | 'dificil';

interface DemoEstado {
  emocion: string;
  intencion: number;
  notas: string;
}

interface DemoCalificacion {
  resultado: 'cerro_venta' | 'abrio_seguimiento' | 'perdio_venta';
  resumen: string;
  puntaje: number;
}

// ── Constants ───────────────────────────────────────────────────────────

const SELLER_PROFILES: { key: SellerProfile; label: string; emoji: string; desc: string }[] = [
  { key: 'agresivo', label: 'Agresivo', emoji: '🔥', desc: 'Presiona mucho, usa urgencia y miedo' },
  { key: 'asertivo', label: 'Asertivo', emoji: '🎯', desc: 'Profesional, consultivo, empático' },
  { key: 'pasivo', label: 'Pasivo', emoji: '🌿', desc: 'Tímido, informativo, no cierra' },
];

const CLIENT_PROFILES: { key: ClientProfile; label: string; emoji: string; desc: string }[] = [
  { key: 'facil', label: 'Fácil', emoji: '😊', desc: 'Interesado, con presupuesto, abierto' },
  { key: 'normal', label: 'Normal', emoji: '🤔', desc: 'Dudas legítimas, abierto a escuchar' },
  {
    key: 'dificil',
    label: 'Difícil',
    emoji: '😤',
    desc: 'Escéptico, desconfiado, muchas objeciones',
  },
];

const EMOTION_COLORS: Record<string, string> = {
  confianza: 'bg-green-500',
  interes: 'bg-blue-500',
  curiosidad: 'bg-cyan-500',
  entusiasmo: 'bg-emerald-500',
  incredulidad: 'bg-yellow-500',
  desconfianza: 'bg-orange-500',
  molestia: 'bg-red-400',
  agresividad: 'bg-red-600',
  bloqueo: 'bg-gray-500',
  aburrimiento: 'bg-gray-400',
};

const EMOTION_EMOJIS: Record<string, string> = {
  confianza: '😌',
  interes: '🧐',
  curiosidad: '🤔',
  entusiasmo: '🤩',
  incredulidad: '😒',
  desconfianza: '🤨',
  molestia: '😠',
  agresividad: '😡',
  bloqueo: '🚫',
  aburrimiento: '😑',
};

const RESULT_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  cerro_venta: { label: 'Cerró la venta', color: 'bg-green-600', emoji: '🎉' },
  abrio_seguimiento: { label: 'Abrió a seguimiento', color: 'bg-yellow-600', emoji: '📋' },
  perdio_venta: { label: 'Perdió la venta', color: 'bg-red-600', emoji: '💔' },
};

// ── Selection UI ────────────────────────────────────────────────────────

function DemoSelectionView({
  onStart,
}: {
  onStart: (mode: DemoMode, insurance: InsuranceType, profile: string) => void;
}) {
  const [mode, setMode] = useState<DemoMode | null>(null);
  const [insurance, setInsurance] = useState<InsuranceType | null>(null);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-foreground mb-2 text-3xl font-bold tracking-tight">Venta de Seguros</h1>
        <p className="text-muted-foreground text-sm">
          Demo de práctica de ventas con agentes de IA
        </p>
      </div>

      {/* Step 1: Choose mode */}
      <div className="w-full max-w-2xl">
        <h2 className="text-foreground mb-3 text-center text-sm font-semibold tracking-wider uppercase">
          1. Elige el modo
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => {
              setMode('vendedor');
              setInsurance(null);
            }}
            className={`rounded-xl border-2 p-6 text-left transition-all ${
              mode === 'vendedor'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-card'
            }`}
          >
            <div className="mb-2 text-3xl">🤖</div>
            <h3 className="text-foreground font-bold">Que te vendan</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Un agente IA te intentará vender un seguro. Tú eres el prospecto.
            </p>
          </button>
          <button
            onClick={() => {
              setMode('cliente');
              setInsurance(null);
            }}
            className={`rounded-xl border-2 p-6 text-left transition-all ${
              mode === 'cliente'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-card'
            }`}
          >
            <div className="mb-2 text-3xl">🎙️</div>
            <h3 className="text-foreground font-bold">Practica ventas</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Tú vendes y el agente IA es el prospecto. Te calificará en tiempo real.
            </p>
          </button>
        </div>
      </div>

      {/* Step 2: Choose insurance type */}
      {mode && (
        <div className="w-full max-w-2xl">
          <h2 className="text-foreground mb-3 text-center text-sm font-semibold tracking-wider uppercase">
            2. Tipo de seguro
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setInsurance('vida')}
              className={`rounded-xl border-2 p-5 text-left transition-all ${
                insurance === 'vida'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              <div className="mb-1 text-2xl">🛡️</div>
              <h3 className="text-foreground font-bold">Seguro de Vida</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Cobertura por fallecimiento, invalidez y ahorro
              </p>
            </button>
            <button
              onClick={() => setInsurance('gastos')}
              className={`rounded-xl border-2 p-5 text-left transition-all ${
                insurance === 'gastos'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 bg-card'
              }`}
            >
              <div className="mb-1 text-2xl">🏥</div>
              <h3 className="text-foreground font-bold">Gastos Médicos</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Cobertura hospitalaria, cirugías y medicamentos
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Choose profile */}
      {mode && insurance && (
        <div className="w-full max-w-2xl">
          <h2 className="text-foreground mb-3 text-center text-sm font-semibold tracking-wider uppercase">
            3. Perfil del {mode === 'vendedor' ? 'vendedor' : 'prospecto'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(mode === 'vendedor' ? SELLER_PROFILES : CLIENT_PROFILES).map((p) => (
              <button
                key={p.key}
                onClick={() => onStart(mode, insurance, p.key)}
                className="border-border hover:border-primary hover:bg-primary/10 bg-card group rounded-xl border-2 p-4 text-center transition-all"
              >
                <div className="mb-1 text-2xl">{p.emoji}</div>
                <h3 className="text-foreground text-sm font-bold">{p.label}</h3>
                <p className="text-muted-foreground mt-1 text-[10px]">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground mt-4 text-xs underline"
      >
        Ir al inicio de sesión
      </Link>
    </div>
  );
}

// ── Live Evaluation Panel ───────────────────────────────────────────────

function IntentionBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">Intención de compra</span>
        <span className="text-foreground font-bold">{value}%</span>
      </div>
      <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function EvaluationPanel({
  estados,
  calificacion,
}: {
  estados: DemoEstado[];
  calificacion: DemoCalificacion | null;
}) {
  const latest = estados.length > 0 ? estados[estados.length - 1] : null;
  const resultInfo = calificacion ? RESULT_LABELS[calificacion.resultado] : null;

  return (
    <div className="border-border bg-card flex h-full flex-col gap-4 overflow-y-auto rounded-xl border p-4">
      <h3 className="text-foreground text-sm font-bold tracking-wider uppercase">
        Evaluación en vivo
      </h3>

      {latest ? (
        <>
          <div>
            <div className="text-muted-foreground mb-1 text-xs">Emoción actual</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{EMOTION_EMOJIS[latest.emocion] || '❓'}</span>
              <span className="text-foreground text-sm font-semibold capitalize">
                {latest.emocion}
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${EMOTION_COLORS[latest.emocion] || 'bg-gray-400'}`}
              />
            </div>
          </div>

          <IntentionBar value={latest.intencion} />

          {latest.notas && (
            <div>
              <div className="text-muted-foreground mb-1 text-xs">Notas del prospecto</div>
              <p className="text-foreground bg-muted rounded-lg p-2 text-xs italic">
                &ldquo;{latest.notas}&rdquo;
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-xs italic">
          Esperando que inicie la conversación...
        </p>
      )}

      {estados.length > 1 && (
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-semibold">Historial</div>
          <div className="flex flex-col gap-1.5">
            {estados.map((e, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs ${
                  i === estados.length - 1
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                <span>{EMOTION_EMOJIS[e.emocion] || '❓'}</span>
                <span className="capitalize">{e.emocion}</span>
                <span className="text-muted-foreground">·</span>
                <span>{e.intencion}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {calificacion && resultInfo && (
        <div className="border-border mt-auto border-t pt-4">
          <div className="mb-2 text-center">
            <span className="text-3xl">{resultInfo.emoji}</span>
            <div
              className={`mx-auto mt-1 w-fit rounded-full px-3 py-1 text-xs font-bold text-white ${resultInfo.color}`}
            >
              {resultInfo.label}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full ${
                  i < calificacion.puntaje ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
            <span className="text-foreground ml-2 text-sm font-bold">
              {calificacion.puntaje}/10
            </span>
          </div>
          <p className="text-muted-foreground mt-2 text-center text-xs">{calificacion.resumen}</p>
        </div>
      )}
    </div>
  );
}

// ── Profile Badge ───────────────────────────────────────────────────────

function ProfileBadge({
  mode,
  insurance,
  profile,
}: {
  mode: DemoMode;
  insurance: InsuranceType;
  profile: string;
}) {
  const isVendedor = mode === 'vendedor';
  const profiles = isVendedor ? SELLER_PROFILES : CLIENT_PROFILES;
  const p = profiles.find((x) => x.key === profile);
  const insuranceLabel = insurance === 'vida' ? 'Seguro de Vida' : 'Gastos Médicos';

  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-lg border px-3 py-2">
      <span className="text-xl">{p?.emoji || '❓'}</span>
      <div>
        <div className="text-foreground text-xs font-bold">
          {isVendedor ? 'Vendedor' : 'Prospecto'}: {p?.label}
        </div>
        <div className="text-muted-foreground text-[10px]">{insuranceLabel}</div>
      </div>
    </div>
  );
}

// ── Data Channel Listener (inside SessionProvider) ──────────────────────

function DataChannelListener({
  onEstado,
  onCalificacion,
}: {
  onEstado: (e: DemoEstado) => void;
  onCalificacion: (c: DemoCalificacion) => void;
}) {
  const { room } = useSessionContext();

  useEffect(() => {
    if (!room) return;

    const handler = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === 'demo_estado') {
          onEstado({
            emocion: data.emocion || '',
            intencion: data.intencion ?? 50,
            notas: data.notas || '',
          });
        } else if (data.type === 'demo_calificacion') {
          onCalificacion({
            resultado: data.resultado || 'perdio_venta',
            resumen: data.resumen || '',
            puntaje: data.puntaje ?? 5,
          });
        }
      } catch {
        // Not a demo data message, ignore
      }
    };

    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, onEstado, onCalificacion]);

  return null;
}

// ── Auto-connect + disconnect detection (inside SessionProvider) ────────

function SessionController({ onDisconnected }: { onDisconnected: () => void }) {
  const { start, isConnected } = useSessionContext();
  const hasStarted = useRef(false);
  const wasConnected = useRef(false);

  useEffect(() => {
    if (!hasStarted.current && !isConnected) {
      hasStarted.current = true;
      start();
    }
  }, [start, isConnected]);

  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      wasConnected.current = false;
      onDisconnected();
    }
  }, [isConnected, onDisconnected]);

  return null;
}

// ── Post-session view ───────────────────────────────────────────────────

function DemoPostSessionView({
  mode,
  insurance,
  profile,
  estados,
  calificacion,
  onNewSession,
  onBack,
}: {
  mode: DemoMode;
  insurance: InsuranceType;
  profile: string;
  estados: DemoEstado[];
  calificacion: DemoCalificacion | null;
  onNewSession: () => void;
  onBack: () => void;
}) {
  const resultInfo = calificacion ? RESULT_LABELS[calificacion.resultado] : null;
  const isClientMode = mode === 'cliente';

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-5xl">{isClientMode && resultInfo ? resultInfo.emoji : '✓'}</div>

        <h1 className="text-foreground text-xl font-bold">Sesión finalizada</h1>

        <ProfileBadge mode={mode} insurance={insurance} profile={profile} />

        {/* Show final rating for client mode */}
        {isClientMode && calificacion && resultInfo && (
          <div className="space-y-3">
            <div
              className={`mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-bold text-white ${resultInfo.color}`}
            >
              {resultInfo.label}
            </div>
            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full ${
                    i < calificacion.puntaje ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
              <span className="text-foreground ml-2 font-bold">{calificacion.puntaje}/10</span>
            </div>
            <p className="text-muted-foreground text-sm">{calificacion.resumen}</p>
          </div>
        )}

        {/* Emotion history summary for client mode */}
        {isClientMode && estados.length > 0 && (
          <div className="border-border rounded-lg border p-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold">
              Recorrido emocional del prospecto
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {estados.map((e, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span>{EMOTION_EMOJIS[e.emocion] || '❓'}</span>
                  <span className="text-muted-foreground">{e.intencion}%</span>
                  {i < estados.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No evaluation data for client mode */}
        {isClientMode && !calificacion && estados.length === 0 && (
          <p className="text-muted-foreground text-sm">
            La sesión fue muy corta para generar una evaluación.
          </p>
        )}

        {/* Vendor mode simple message */}
        {!isClientMode && (
          <p className="text-muted-foreground text-sm">
            ¿Cómo te fue con el vendedor? Prueba otro perfil o tipo de seguro.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onNewSession}
            className="bg-primary text-primary-foreground w-full rounded-full px-6 py-2.5 font-mono text-xs font-bold uppercase"
          >
            Nueva sesión
          </button>
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Elegir otro modo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Demo Session View ───────────────────────────────────────────────────

function DemoSessionInner({
  appConfig,
  personalityKey,
  profile,
  mode,
  insurance,
  onBack,
  onNewSession,
}: {
  appConfig: AppConfig;
  personalityKey: string;
  profile: string;
  mode: DemoMode;
  insurance: InsuranceType;
  onBack: () => void;
  onNewSession: () => void;
}) {
  const configs = useMemo(() => loadConfigs(), []);
  const personalityConfig = useMemo(
    () => getConfig(configs, personalityKey),
    [configs, personalityKey]
  );

  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality: personalityKey,
          voiceId: personalityConfig.voiceId,
          temperature: personalityConfig.temperature,
          speed: personalityConfig.speed ?? 1.0,
          model: personalityConfig.model,
          demoProfile: profile,
        }),
      });
      if (!res.ok) throw new Error(`Token error: ${res.status}`);
      return await res.json();
    });
  }, [personalityKey, personalityConfig, profile]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  const isClientMode = mode === 'cliente';

  const [estados, setEstados] = useState<DemoEstado[]>([]);
  const [calificacion, setCalificacion] = useState<DemoCalificacion | null>(null);
  const [showPostSession, setShowPostSession] = useState(false);

  const handleEstado = useCallback((e: DemoEstado) => {
    setEstados((prev) => [...prev, e]);
  }, []);
  const handleCalificacion = useCallback((c: DemoCalificacion) => {
    setCalificacion(c);
  }, []);
  const handleDisconnected = useCallback(() => {
    setShowPostSession(true);
  }, []);

  if (showPostSession) {
    return (
      <DemoPostSessionView
        mode={mode}
        insurance={insurance}
        profile={profile}
        estados={estados}
        calificacion={calificacion}
        onNewSession={onNewSession}
        onBack={onBack}
      />
    );
  }

  return (
    <AgentSessionProvider session={session}>
      <SessionController onDisconnected={handleDisconnected} />
      {isClientMode && (
        <DataChannelListener onEstado={handleEstado} onCalificacion={handleCalificacion} />
      )}

      {/* Header bar */}
      <div className="bg-background border-border fixed top-0 right-0 left-0 z-50 flex items-center gap-3 border-b px-4 py-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          ← Volver
        </button>
        <ProfileBadge mode={mode} insurance={insurance} profile={profile} />
        <div className="text-foreground ml-auto text-xs font-semibold">
          {mode === 'vendedor' ? '🤖 IA te vende' : '🎙️ Tú vendes'}
        </div>
      </div>

      {/* Main content */}
      <div className={`h-svh pt-14 ${isClientMode ? 'grid grid-cols-[1fr_300px]' : ''}`}>
        {/* Voice session area */}
        <AgentSessionView_01
          personality={personalityKey}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={false}
          supportsScreenShare={false}
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
          audioVisualizerType={personalityConfig.visualizer}
          className={isClientMode ? 'h-full' : 'fixed inset-0 pt-14'}
        />

        {/* Evaluation sidebar (client mode only) */}
        {isClientMode && (
          <div className="border-border h-full overflow-hidden border-l p-3">
            <EvaluationPanel estados={estados} calificacion={calificacion} />
          </div>
        )}
      </div>

      <StartAudioButton label="Iniciar Audio" />
      <Toaster position="top-center" />
    </AgentSessionProvider>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export function DemoSeguros({ appConfig }: { appConfig: AppConfig }) {
  const [sessionKey, setSessionKey] = useState(0);
  const [activeSession, setActiveSession] = useState<{
    mode: DemoMode;
    insurance: InsuranceType;
    profile: string;
    personalityKey: string;
  } | null>(null);

  const handleStart = useCallback((mode: DemoMode, insurance: InsuranceType, profile: string) => {
    const prefix = mode === 'vendedor' ? 'demo_vendedor' : 'demo_cliente';
    const personalityKey = `${prefix}_${insurance}`;
    setActiveSession({ mode, insurance, profile, personalityKey });
    setSessionKey((prev) => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    setActiveSession(null);
  }, []);

  const handleNewSession = useCallback(() => {
    if (!activeSession) return;
    // Re-launch same config with new key to remount
    setSessionKey((prev) => prev + 1);
  }, [activeSession]);

  if (!activeSession) {
    return <DemoSelectionView onStart={handleStart} />;
  }

  return (
    <DemoSessionInner
      key={sessionKey}
      appConfig={appConfig}
      personalityKey={activeSession.personalityKey}
      profile={activeSession.profile}
      mode={activeSession.mode}
      insurance={activeSession.insurance}
      onBack={handleBack}
      onNewSession={handleNewSession}
    />
  );
}
