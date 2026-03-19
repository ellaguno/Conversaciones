'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { ConversationLogView } from '@/components/app/conversation-log-view';
import { NotesView } from '@/components/app/notes-view';
import { TranscribeView } from '@/components/app/transcribe-view';
import { type TherapyOptions, WelcomeView } from '@/components/app/welcome-view';
import type { PersonalityConfig } from '@/lib/personalities-config';
import { DEFAULT_CONFIGS } from '@/lib/personalities-config';

const VISION_PERSONALITIES = new Set([
  'asesor_sistemas',
  'asesor_office',
  'asesor_web',
  'asesor_tecnico',
]);

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.5, ease: 'linear' },
};

function PostSessionView({
  personalityKey,
  personalityName,
  onContinue,
  isGuest,
}: {
  personalityKey: string;
  personalityName: string;
  onContinue: () => void;
  isGuest?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleEmail = useCallback(async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/conversations/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personality: personalityKey,
          personalityName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar');
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }, [personalityKey, personalityName]);

  return (
    <div className="bg-background flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl">&#10003;</div>
        <h1 className="text-foreground text-lg font-bold">Sesion finalizada</h1>
        <p className="text-muted-foreground text-sm">
          Tu conversacion con <strong>{personalityName}</strong> ha sido guardada.
        </p>
        {!isGuest && (
          <div className="space-y-2">
            {sent ? (
              <p className="text-sm text-green-600">Correo enviado correctamente</p>
            ) : (
              <button
                onClick={handleEmail}
                disabled={sending}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 w-full rounded-full px-6 py-2.5 font-mono text-xs font-bold uppercase disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Enviar transcripcion por correo'}
              </button>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
        <button
          onClick={onContinue}
          className="bg-primary text-primary-foreground w-full rounded-full px-6 py-2.5 font-mono text-xs font-bold uppercase"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

interface ViewControllerProps {
  appConfig: AppConfig;
  selectedPersonality: string;
  activePersonality: string;
  onSelectPersonality: (personality: string) => void;
  onStartCall: (personality: string, patientId?: string, therapy?: TherapyOptions) => void;
  autoConnect?: boolean;
  onDisconnected?: () => void;
  personalityConfig: PersonalityConfig;
  onOpenSettings: () => void;
  onLogout: () => void;
  onAdminPanel?: () => void;
  isAdmin?: boolean;
  initialPatientId?: string;
  isGuest?: boolean;
  adminLayoutDefaults?: Record<string, number> | null;
}

export function ViewController({
  appConfig,
  selectedPersonality,
  activePersonality,
  onSelectPersonality,
  onStartCall,
  autoConnect,
  onDisconnected,
  personalityConfig,
  onOpenSettings,
  onLogout,
  onAdminPanel,
  isAdmin,
  initialPatientId,
  isGuest,
  adminLayoutDefaults,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const wasConnected = useRef(false);
  const hasAutoStarted = useRef(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showConversations, setShowConversations] = useState<string | null>(null);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [showPostSession, setShowPostSession] = useState(false);

  // Detect disconnection to reset autoConnect
  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      wasConnected.current = false;
      setShowPostSession(true);
      onDisconnected?.();
    }
  }, [isConnected, onDisconnected]);

  // Auto-connect ONCE when component mounts with autoConnect=true.
  // hasAutoStarted ensures start() is never called more than once per mount,
  // preventing reconnection after user clicks "Finalizar".
  // SessionInner remounts (new key={sessionId}) for each new call, resetting this ref.
  useEffect(() => {
    if (autoConnect && !isConnected && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      start();
    }
  }, [autoConnect, isConnected, start]);

  // Post-session view
  if (showPostSession && !isConnected) {
    const config = DEFAULT_CONFIGS[activePersonality];
    return (
      <PostSessionView
        personalityKey={activePersonality}
        personalityName={config?.name || activePersonality}
        onContinue={() => setShowPostSession(false)}
        isGuest={isGuest}
      />
    );
  }

  // Transcribe view
  if (showTranscribe && !isConnected) {
    return <TranscribeView onBack={() => setShowTranscribe(false)} />;
  }

  // Notes view (Dra. Ana)
  if (showNotes && !isConnected) {
    return (
      <NotesView
        onBack={() => setShowNotes(false)}
        onStartSession={(patientId?: string) => {
          setShowNotes(false);
          onStartCall('psicologo', patientId);
        }}
      />
    );
  }

  // Conversation log view (all other personalities)
  if (showConversations && !isConnected) {
    const config = DEFAULT_CONFIGS[showConversations];
    return (
      <ConversationLogView
        personality={showConversations}
        personalityName={config?.name || showConversations}
        onBack={() => setShowConversations(null)}
        onStartCall={() => {
          const p = showConversations;
          setShowConversations(null);
          onStartCall(p);
        }}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!isConnected && !autoConnect && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          selectedPersonality={selectedPersonality}
          onSelectPersonality={onSelectPersonality}
          onStartCall={onStartCall}
          onViewNotes={isGuest ? undefined : () => setShowNotes(true)}
          onViewConversations={isGuest ? undefined : (p: string) => setShowConversations(p)}
          onTranscribe={isGuest ? undefined : () => setShowTranscribe(true)}
          onOpenSettings={isGuest ? undefined : onOpenSettings}
          onLogout={isGuest ? undefined : onLogout}
          onAdminPanel={isGuest ? undefined : onAdminPanel}
          isAdmin={isGuest ? false : isAdmin}
          initialPatientId={initialPatientId}
          isGuest={isGuest}
          adminLayoutDefaults={adminLayoutDefaults}
        />
      )}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          personality={activePersonality}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={
            appConfig.supportsScreenShare || VISION_PERSONALITIES.has(activePersonality)
          }
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
          audioVisualizerType={personalityConfig.visualizer || appConfig.audioVisualizerType}
          audioVisualizerColor={
            resolvedTheme === 'dark'
              ? appConfig.audioVisualizerColorDark
              : appConfig.audioVisualizerColor
          }
          audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
          audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
          audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
          className="fixed inset-0"
        />
      )}
    </AnimatePresence>
  );
}
