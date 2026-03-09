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
  {
    key: 'normal',
    name: 'Alguien Normal',
    description: 'Una persona normal para platicar',
    emoji: '👤',
  },
  {
    key: 'espiritual',
    name: 'Guía Espiritual',
    description: 'Elige una tradición',
    emoji: '🕊️',
  },
];

const SPIRITUAL_GUIDES = [
  { key: 'estoico', name: 'Filósofo Estoico' },
  { key: 'sacerdote', name: 'Sacerdote Católico' },
  { key: 'monje', name: 'Monje Budista' },
  { key: 'imam', name: 'Imán Musulmán' },
  { key: 'rabino', name: 'Rabino Judío' },
  { key: 'pandit', name: 'Pandit Hindú' },
];

const THERAPY_METHODS = [
  { key: 'cbt', name: 'CBT - Cognitivo-Conductual', short: 'CBT' },
  { key: 'act', name: 'ACT - Aceptacion y Compromiso', short: 'ACT' },
  { key: 'dbt', name: 'DBT - Dialectico-Conductual', short: 'DBT' },
  { key: 'mindfulness', name: 'Mindfulness - Atencion Plena', short: 'Mindfulness' },
  { key: 'gestalt', name: 'Gestalt / Sistemica', short: 'Gestalt' },
];

interface Metrics {
  total_tokens: number;
  total_cost_usd: number;
  llm_calls: number;
}

interface PatientInfo {
  id: string;
  name: string;
  sessionNumber: number;
  sessionsCount: number;
}

export interface TherapyOptions {
  therapyMethod?: string;
  coupleTherapy?: boolean;
}

interface WelcomeViewProps {
  startButtonText: string;
  selectedPersonality: string;
  onSelectPersonality: (personality: string) => void;
  onStartCall: (personality: string, patientId?: string, therapy?: TherapyOptions) => void;
  onViewNotes?: () => void;
  onViewConversations?: (personality: string) => void;
  onTranscribe?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  onAdminPanel?: () => void;
  isAdmin?: boolean;
}

export const WelcomeView = ({
  startButtonText,
  selectedPersonality,
  onSelectPersonality,
  onStartCall,
  onViewNotes,
  onViewConversations,
  onTranscribe,
  onOpenSettings,
  onLogout,
  onAdminPanel,
  isAdmin,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [selectedGuide, setSelectedGuide] = useState('estoico');
  const [conversationCounts, setConversationCounts] = useState<Record<string, number>>({});
  const [therapyMethod, setTherapyMethod] = useState('cbt');
  const [coupleTherapy, setCoupleTherapy] = useState(false);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => {
        const counts: Record<string, number> = {};
        for (const p of data.personalities || []) {
          counts[p.personality] = p.conversations.length;
        }
        setConversationCounts(counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedPersonality === 'psicologo') {
      fetch('/api/sessions')
        .then((r) => r.json())
        .then((data) => {
          const list: PatientInfo[] = (data.patients || []).map(
            (p: { id: string; name: string; sessionNumber: number; sessions: unknown[] }) => ({
              id: p.id,
              name: p.name,
              sessionNumber: p.sessionNumber,
              sessionsCount: p.sessions.length,
            })
          );
          setPatients(list);
          if (list.length > 0 && !selectedPatientId) {
            setSelectedPatientId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [selectedPersonality, selectedPatientId]);

  const isPsicologo = selectedPersonality === 'psicologo';
  const isEspiritual = selectedPersonality === 'espiritual';
  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div ref={ref}>
      <section className="bg-background flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-foreground mb-1 text-2xl font-bold">Conversaciones</h1>

        {/* Metrics bar */}
        {metrics && metrics.total_tokens > 0 && (
          <div className="border-border bg-muted/40 text-muted-foreground mb-4 flex items-center gap-4 rounded-full border px-4 py-1.5 font-mono text-[11px]">
            <span>{metrics.total_tokens.toLocaleString()} tokens</span>
            <span className="text-border">|</span>
            <span>${metrics.total_cost_usd.toFixed(4)} USD</span>
            <span className="text-border">|</span>
            <span>{metrics.llm_calls} llamadas</span>
          </div>
        )}

        <p className="text-muted-foreground mb-5 text-sm">Elige con quien quieres hablar</p>

        <div className="mb-5 grid w-full max-w-md grid-cols-3 gap-2.5">
          {PERSONALITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => onSelectPersonality(p.key)}
              className={`flex flex-col items-center rounded-xl border-2 px-3 py-2.5 transition-all ${
                selectedPersonality === p.key
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-md'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <span className="mb-1 text-xl">{p.emoji}</span>
              <span className="text-foreground text-xs font-semibold">{p.name}</span>
              <span className="text-muted-foreground text-[10px]">{p.description}</span>
            </button>
          ))}
        </div>

        {/* Spiritual guide selector */}
        {isEspiritual && (
          <div className="mb-4 w-full max-w-sm">
            <select
              value={selectedGuide}
              onChange={(e) => setSelectedGuide(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-xl border-2 px-4 py-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            >
              {SPIRITUAL_GUIDES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dra. Ana patient selector */}
        {isPsicologo && (
          <div className="mb-4 w-full max-w-sm">
            {/* Patient list */}
            {patients.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setCreatingPatient(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
                      selectedPatientId === p.id
                        ? 'border-purple-400 bg-purple-50 shadow-sm dark:border-purple-600 dark:bg-purple-950/30'
                        : 'border-border hover:border-purple-300 dark:hover:border-purple-700'
                    }`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-200 text-sm dark:bg-purple-800">
                      👤
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-bold">{p.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {p.sessionsCount} {p.sessionsCount === 1 ? 'sesion' : 'sesiones'} &middot;
                        Proxima: #{p.sessionNumber}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* New patient form */}
            {creatingPatient ? (
              <div className="rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-3 dark:border-purple-700 dark:bg-purple-950/20">
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingPatient(false);
                      setNewPatientName('');
                    }
                  }}
                  placeholder="Nombre del paciente"
                  autoFocus
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground mb-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                />

                {/* Therapy method selector */}
                <label className="text-muted-foreground mt-2 mb-1 block text-left text-[11px] font-semibold uppercase">
                  Enfoque terapeutico
                </label>
                <select
                  value={therapyMethod}
                  onChange={(e) => setTherapyMethod(e.target.value)}
                  className="border-border bg-background text-foreground mb-2 w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                >
                  {THERAPY_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {/* Couple therapy toggle */}
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-left">
                  <input
                    type="checkbox"
                    checked={coupleTherapy}
                    onChange={(e) => setCoupleTherapy(e.target.checked)}
                    className="h-4 w-4 rounded border-purple-400 accent-purple-600"
                  />
                  <span className="text-foreground text-xs font-medium">Terapia de pareja</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const patientId = newPatientName
                        .trim()
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_-]/g, '');
                      if (patientId) {
                        setCreatingPatient(false);
                        setNewPatientName('');
                        onStartCall('psicologo', patientId, {
                          therapyMethod,
                          coupleTherapy,
                        });
                      }
                    }}
                    disabled={!newPatientName.trim()}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                  >
                    Iniciar primera sesion
                  </button>
                  <button
                    onClick={() => {
                      setCreatingPatient(false);
                      setNewPatientName('');
                    }}
                    className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-3 py-1.5 text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCreatingPatient(true);
                  setSelectedPatientId(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-purple-300 p-2.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20"
              >
                <span className="text-base">+</span>
                Nuevo paciente
              </button>
            )}

            <p className="text-muted-foreground mt-2 text-center text-xs">{today}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex w-64 flex-col gap-2">
          {isPsicologo ? (
            <>
              <Button
                size="lg"
                onClick={() => onStartCall('psicologo', selectedPatientId || undefined)}
                disabled={!selectedPatientId}
                className="w-full rounded-full bg-purple-600 font-mono text-xs font-bold tracking-wider uppercase hover:bg-purple-700 disabled:opacity-50"
              >
                Iniciar sesion
              </Button>
              {onViewNotes && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onViewNotes}
                  className="w-full rounded-full border-purple-300 font-mono text-xs font-bold tracking-wider text-purple-700 uppercase hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
                >
                  Ver notas
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                size="lg"
                onClick={() => onStartCall(isEspiritual ? selectedGuide : selectedPersonality)}
                className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
              >
                {startButtonText}
              </Button>
              {(() => {
                const effectiveKey = isEspiritual ? selectedGuide : selectedPersonality;
                const count = conversationCounts[effectiveKey] || 0;
                if (count > 0 && onViewConversations) {
                  return (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => onViewConversations(effectiveKey)}
                      className="w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
                    >
                      Ver conversaciones ({count})
                    </Button>
                  );
                }
                return null;
              })()}
            </>
          )}
        </div>

        {/* Settings, admin & logout links */}
        <div className="mt-4 flex items-center gap-4">
          {onTranscribe && (
            <button
              onClick={onTranscribe}
              className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
            >
              Transcribir audio
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
            >
              Configuracion
            </button>
          )}
          {isAdmin && onAdminPanel && (
            <button
              onClick={onAdminPanel}
              className="text-muted-foreground text-xs underline transition-colors hover:text-amber-600 dark:hover:text-amber-400"
            >
              Usuarios
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-muted-foreground text-xs underline transition-colors hover:text-red-500"
            >
              Salir
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
