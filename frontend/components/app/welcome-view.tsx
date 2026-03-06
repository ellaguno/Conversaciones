'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const PERSONALITIES = [
  {
    key: 'trader',
    name: 'Carlos el Trader',
    description: 'Experto en mercados financieros',
    emoji: '📈',
  },
  {
    key: 'abogado',
    name: 'Lic. Martinez',
    description: 'Abogado corporativo',
    emoji: '⚖️',
  },
  {
    key: 'psicologo',
    name: 'Dra. Ana',
    description: 'Psicóloga clínica',
    emoji: '🧠',
  },
  {
    key: 'hippy',
    name: 'Paz',
    description: 'Sabio alternativo',
    emoji: '☮️',
  },
];

interface Metrics {
  total_tokens: number;
  total_cost_usd: number;
  llm_calls: number;
}

interface SessionInfo {
  patientName: string;
  sessionNumber: number;
  sessionsCount: number;
}

interface WelcomeViewProps {
  startButtonText: string;
  selectedPersonality: string;
  onSelectPersonality: (personality: string) => void;
  onStartCall: (personality: string) => void;
  onViewNotes?: () => void;
}

export const WelcomeView = ({
  startButtonText,
  selectedPersonality,
  onSelectPersonality,
  onStartCall,
  onViewNotes,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedPersonality === 'psicologo') {
      fetch('/api/sessions')
        .then((r) => r.json())
        .then((data) => {
          if (data.patients?.length > 0) {
            const p = data.patients[0];
            setSessionInfo({
              patientName: p.name,
              sessionNumber: p.sessionNumber,
              sessionsCount: p.sessions.length,
            });
          }
        })
        .catch(() => {});
    }
  }, [selectedPersonality]);

  const isPsicologo = selectedPersonality === 'psicologo';
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div ref={ref}>
      <section className="bg-background flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-foreground mb-1 text-2xl font-bold">Conversaciones</h1>

        {/* Metrics bar */}
        {metrics && metrics.total_tokens > 0 && (
          <div className="mb-4 flex items-center gap-4 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground font-mono">
            <span>{metrics.total_tokens.toLocaleString()} tokens</span>
            <span className="text-border">|</span>
            <span>${metrics.total_cost_usd.toFixed(4)} USD</span>
            <span className="text-border">|</span>
            <span>{metrics.llm_calls} llamadas</span>
          </div>
        )}

        <p className="text-muted-foreground mb-5 text-sm">Elige con quien quieres hablar</p>

        <div className="mb-5 grid grid-cols-2 gap-3 w-full max-w-sm">
          {PERSONALITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => onSelectPersonality(p.key)}
              className={`flex flex-col items-center rounded-xl border-2 px-4 py-3 transition-all ${
                selectedPersonality === p.key
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-md'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <span className="mb-1 text-2xl">{p.emoji}</span>
              <span className="text-foreground text-sm font-semibold">{p.name}</span>
              <span className="text-muted-foreground text-xs">{p.description}</span>
            </button>
          ))}
        </div>

        {/* Dra. Ana session info */}
        {isPsicologo && sessionInfo && (
          <div className="mb-4 w-full max-w-sm rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-800 text-sm">
                👤
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{sessionInfo.patientName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {sessionInfo.sessionsCount} sesiones &middot; Proxima: #{sessionInfo.sessionNumber}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 w-64">
          <Button
            size="lg"
            onClick={() => onStartCall(selectedPersonality)}
            className={`w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase ${
              isPsicologo ? 'bg-purple-600 hover:bg-purple-700' : ''
            }`}
          >
            {isPsicologo ? 'Iniciar sesion' : startButtonText}
          </Button>

          {isPsicologo && onViewNotes && (
            <Button
              size="lg"
              variant="outline"
              onClick={onViewNotes}
              className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            >
              Ver notas
            </Button>
          )}
        </div>
      </section>
    </div>
  );
};
