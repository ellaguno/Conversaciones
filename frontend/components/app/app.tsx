'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut, useSession as useAuthSession } from 'next-auth/react';
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
          onAdminPanel={onAdminPanel}
          isAdmin={isAdmin}
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
  const { data: authSession } = useAuthSession();
  const router = useRouter();
  const isAdmin = (authSession?.user as { role?: string } | undefined)?.role === 'admin';
  const [selectedPersonality, setSelectedPersonality] = useState('trader');
  const [activePersonality, setActivePersonality] = useState('trader');
  const [activePatientId, setActivePatientId] = useState('');
  const [sessionId, setSessionId] = useState(0);
  const [autoConnect, setAutoConnect] = useState(false);
  const [configs, setConfigs] = useState<Record<string, PersonalityConfig>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [activeTherapyMethod, setActiveTherapyMethod] = useState('');
  const [activeCoupleTherapy, setActiveCoupleTherapy] = useState(false);

  useEffect(() => {
    setConfigs(loadConfigs());
  }, []);

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

  if (showSettings) {
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
    />
  );
}
