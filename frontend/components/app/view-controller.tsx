'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';
import { NotesView } from '@/components/app/notes-view';

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
  onStartCall: (personality: string) => void;
  autoConnect?: boolean;
  onDisconnected?: () => void;
}

export function ViewController({
  appConfig,
  selectedPersonality,
  activePersonality,
  onSelectPersonality,
  onStartCall,
  autoConnect,
  onDisconnected,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const wasConnected = useRef(false);
  const [showNotes, setShowNotes] = useState(false);

  // Auto-connect when remounted after personality change
  useEffect(() => {
    if (autoConnect && !isConnected) {
      start();
    }
  }, [autoConnect, isConnected, start]);

  // Detect disconnection to reset autoConnect
  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      wasConnected.current = false;
      onDisconnected?.();
    }
  }, [isConnected, onDisconnected]);

  // Notes view (outside of AnimatePresence/session)
  if (showNotes && !isConnected) {
    return (
      <NotesView
        onBack={() => setShowNotes(false)}
        onStartSession={() => {
          setShowNotes(false);
          onStartCall('psicologo');
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
          audioVisualizerType={
            activePersonality === 'psicologo' ? 'aura' : appConfig.audioVisualizerType
          }
          audioVisualizerColor={
            activePersonality === 'psicologo'
              ? (resolvedTheme === 'dark' ? '#7c3aed' : '#8b5cf6')
              : (resolvedTheme === 'dark'
                  ? appConfig.audioVisualizerColorDark
                  : appConfig.audioVisualizerColor)
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
