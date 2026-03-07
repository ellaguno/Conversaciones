'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CARTESIA_VOICES_ES,
  VISUALIZER_TYPES,
  DEFAULT_CONFIGS,
  type PersonalityConfig,
} from '@/lib/personalities-config';

const ALL_PERSONALITIES = [
  { key: 'trader', emoji: '📈' },
  { key: 'abogado', emoji: '⚖️' },
  { key: 'psicologo', emoji: '🧠' },
  { key: 'hippy', emoji: '☮️' },
  { key: 'normal', emoji: '👤' },
  { key: 'estoico', emoji: '🏛️' },
  { key: 'sacerdote', emoji: '✝️' },
  { key: 'monje', emoji: '☸️' },
  { key: 'imam', emoji: '☪️' },
  { key: 'rabino', emoji: '✡️' },
  { key: 'pandit', emoji: '🕉️' },
];

interface SettingsViewProps {
  configs: Record<string, PersonalityConfig>;
  onSave: (configs: Record<string, PersonalityConfig>) => void;
  onBack: () => void;
}

export function SettingsView({ configs, onSave, onBack }: SettingsViewProps) {
  const [draft, setDraft] = useState<Record<string, PersonalityConfig>>({ ...configs });
  const [selected, setSelected] = useState(ALL_PERSONALITIES[0].key);

  const current = draft[selected] || DEFAULT_CONFIGS[selected];

  const update = (field: keyof PersonalityConfig, value: string | number) => {
    setDraft((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], ...DEFAULT_CONFIGS[selected], ...prev[selected], [field]: value },
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onBack();
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_CONFIGS });
  };

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Configuracion</h1>
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-full text-xs">
            Volver
          </Button>
        </div>

        {/* Personality selector tabs */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {ALL_PERSONALITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                selected === p.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="mr-1">{p.emoji}</span>
              {(draft[p.key] || DEFAULT_CONFIGS[p.key])?.name?.split(' ')[0] || p.key}
            </button>
          ))}
        </div>

        {/* Settings form */}
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">
              Nombre del personaje
            </label>
            <input
              type="text"
              value={current.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Voice */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">
              Voz
            </label>
            <select
              value={current.voiceId}
              onChange={(e) => update('voiceId', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {CARTESIA_VOICES_ES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Visualizer */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">
              Vista de voz
            </label>
            <div className="flex gap-2">
              {VISUALIZER_TYPES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => update('visualizer', v.key)}
                  className={`flex-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all ${
                    current.visualizer === v.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
              <span>Creatividad / Temperatura</span>
              <span className="text-foreground font-mono normal-case">{current.temperature.toFixed(1)}</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-[10px]">Preciso</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={current.temperature}
                onChange={(e) => update('temperature', parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-muted-foreground text-[10px]">Creativo</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button onClick={handleSave} className="flex-1 rounded-full font-mono text-xs font-bold uppercase">
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="rounded-full text-xs"
          >
            Restaurar defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
