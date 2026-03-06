'use client';

import { useCallback, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface AppProps {
  appConfig: AppConfig;
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
}: {
  appConfig: AppConfig;
  personality: string;
  patientId: string;
  autoConnect: boolean;
  selectedPersonality: string;
  onSelectPersonality: (p: string) => void;
  onStartCall: (p: string, patientId?: string) => void;
  onDisconnected: () => void;
}) {
  const tokenSource = useMemo(() => {
    return TokenSource.custom(async () => {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality, patientId }),
      });
      if (!res.ok) {
        throw new Error(`Token error: ${res.status}`);
      }
      return await res.json();
    });
  }, [personality, patientId]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          selectedPersonality={selectedPersonality}
          activePersonality={personality}
          onSelectPersonality={onSelectPersonality}
          onStartCall={onStartCall}
          autoConnect={autoConnect}
          onDisconnected={onDisconnected}
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

export function App({ appConfig }: AppProps) {
  const [selectedPersonality, setSelectedPersonality] = useState('trader');
  const [activePersonality, setActivePersonality] = useState('trader');
  const [activePatientId, setActivePatientId] = useState('');
  const [sessionId, setSessionId] = useState(0);
  const [autoConnect, setAutoConnect] = useState(false);

  const handleStartCall = useCallback((personality: string, patientId?: string) => {
    setSelectedPersonality(personality);
    setActivePersonality(personality);
    setActivePatientId(patientId || '');
    setAutoConnect(true);
    setSessionId((prev) => prev + 1);
  }, []);

  const handleDisconnected = useCallback(() => {
    setAutoConnect(false);
  }, []);

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
    />
  );
}
