'use client';

import { useEffect, useRef, useState } from 'react';
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
  'asesor_sistemas', 'asesor_office', 'asesor_web', 'asesor_tecnico',
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
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const wasConnected = useRef(false);
  const hasAutoStarted = useRef(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showConversations, setShowConversations] = useState<string | null>(null);
  const [showTranscribe, setShowTranscribe] = useState(false);

  // Detect disconnection to reset autoConnect
  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
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
          onViewNotes={() => setShowNotes(true)}
          onViewConversations={(p: string) => setShowConversations(p)}
          onTranscribe={() => setShowTranscribe(true)}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
          onAdminPanel={onAdminPanel}
          isAdmin={isAdmin}
        />
      )}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          personality={activePersonality}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare || VISION_PERSONALITIES.has(activePersonality)}
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
