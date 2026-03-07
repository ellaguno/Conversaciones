'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { ConversationLogView } from '@/components/app/conversation-log-view';
import { NotesView } from '@/components/app/notes-view';
import { type TherapyOptions, WelcomeView } from '@/components/app/welcome-view';
import type { PersonalityConfig } from '@/lib/personalities-config';
import { DEFAULT_CONFIGS } from '@/lib/personalities-config';

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
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const wasConnected = useRef(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showConversations, setShowConversations] = useState<string | null>(null);

  // Detect disconnection to reset autoConnect (must run before auto-connect effect)
  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      wasConnected.current = false;
      onDisconnected?.();
    }
  }, [isConnected, onDisconnected]);

  // Auto-connect when remounted after personality change
  // Skip if wasConnected was true — that means user intentionally disconnected
  useEffect(() => {
    if (autoConnect && !isConnected && !wasConnected.current) {
      start();
    }
  }, [autoConnect, isConnected, start]);

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
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
      )}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          personality={activePersonality}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
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
