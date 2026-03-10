'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CARTESIA_VOICES_ES,
  DEFAULT_CONFIGS,
  DEFAULT_MODEL,
  type PersonalityConfig,
  VISUALIZER_TYPES,
} from '@/lib/personalities-config';

const ALL_PERSONALITIES = [
  { key: 'trader', emoji: '📈' },
  { key: 'abogado', emoji: '⚖️' },
  { key: 'psicologo', emoji: '🧠' },
  { key: 'asesor_sistemas', emoji: '🖥️' },
  { key: 'asesor_office', emoji: '📄' },
  { key: 'asesor_web', emoji: '🌐' },
  { key: 'asesor_tecnico', emoji: '🔧' },
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const current = draft[selected] || DEFAULT_CONFIGS[selected];

  const update = (field: keyof PersonalityConfig, value: string | number) => {
    setDraft((prev) => ({
      ...prev,
      [selected]: {
        ...prev[selected],
        ...DEFAULT_CONFIGS[selected],
        ...prev[selected],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onBack();
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_CONFIGS });
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Las contraseñas no coinciden', error: true });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ text: 'Mínimo 4 caracteres', error: true });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ text: 'Contraseña cambiada', error: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ text: data.error || 'Error', error: true });
      }
    } catch {
      setPasswordMsg({ text: 'Error de conexion', error: true });
    }
    setChangingPassword(false);
  };

  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-foreground text-xl font-bold">Configuracion</h1>
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
        <div className="border-border bg-card space-y-5 rounded-xl border p-5">
          {/* Name */}
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
              Nombre del personaje
            </label>
            <input
              type="text"
              value={current.name}
              onChange={(e) => update('name', e.target.value)}
              className="border-border bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          {/* Voice */}
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
              Voz
            </label>
            <select
              value={current.voiceId}
              onChange={(e) => update('voiceId', e.target.value)}
              className="border-border bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
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
            <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
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
            <label className="text-muted-foreground mb-1 flex items-center justify-between text-xs font-semibold uppercase">
              <span>Creatividad / Temperatura</span>
              <span className="text-foreground font-mono normal-case">
                {current.temperature.toFixed(1)}
              </span>
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
                className="accent-primary flex-1"
              />
              <span className="text-muted-foreground text-[10px]">Creativo</span>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-semibold uppercase">
              Modelo de IA (OpenRouter)
            </label>
            <input
              type="text"
              value={current.model || DEFAULT_MODEL}
              onChange={(e) => update('model', e.target.value)}
              placeholder={DEFAULT_MODEL}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
            />
            <p className="text-muted-foreground mt-1 text-[10px]">
              Modelo para conversacion en vivo. Ej: google/gemini-2.5-flash, openai/gpt-4o-mini,
              meta-llama/llama-4-scout
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleSave}
            className="flex-1 rounded-full font-mono text-xs font-bold uppercase"
          >
            Guardar
          </Button>
          <Button variant="outline" onClick={handleReset} className="rounded-full text-xs">
            Restaurar defaults
          </Button>
        </div>

        {/* Password change */}
        <div className="border-border bg-card mt-8 rounded-xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-bold">Cambiar contraseña</h2>
          <div className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Contraseña actual"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
            {passwordMsg && (
              <p
                className={`text-xs ${passwordMsg.error ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
              >
                {passwordMsg.text}
              </p>
            )}
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              className="w-full rounded-full text-xs font-bold"
            >
              {changingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
