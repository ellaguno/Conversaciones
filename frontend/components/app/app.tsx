'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { SettingsView } from '@/components/app/settings-view';
import { ViewController } from '@/components/app/view-controller';
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
}: {
  appConfig: AppConfig;
  personality: string;
  patientId: string;
  autoConnect: boolean;
  selectedPersonality: string;
  onSelectPersonality: (p: string) => void;
  onStartCall: (p: string, patientId?: string) => void;
  onDisconnected: () => void;
  personalityConfig: PersonalityConfig;
  onOpenSettings: () => void;
  onLogout: () => void;
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
        }),
      });
      if (!res.ok) {
        throw new Error(`Token error: ${res.status}`);
      }
      return await res.json();
    });
  }, [personality, patientId, personalityConfig.voiceId, personalityConfig.temperature]);

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
          personalityConfig={personalityConfig}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
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
  const [configs, setConfigs] = useState<Record<string, PersonalityConfig>>({});
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setConfigs(loadConfigs());
  }, []);

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

  const handleSaveConfigs = useCallback((newConfigs: Record<string, PersonalityConfig>) => {
    setConfigs(newConfigs);
    saveConfigs(newConfigs);
  }, []);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  if (showSettings) {
    return (
      <SettingsView
        configs={configs}
        onSave={handleSaveConfigs}
        onBack={() => setShowSettings(false)}
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
    />
  );
}
