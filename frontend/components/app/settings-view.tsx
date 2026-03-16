'use client';

import { useEffect, useState } from 'react';
import {
  type PersonalityLayout,
  loadPersonalityLayout,
  savePersonalityLayout,
} from '@/components/app/welcome-view';
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

const PERSONALITY_CATEGORIES = [
  { key: 'trader', name: 'Trader', emoji: '📈' },
  { key: 'abogado', name: 'Abogado', emoji: '⚖️' },
  { key: 'psicologo', name: 'Dra. Ana', emoji: '🧠' },
  { key: 'asesor', name: 'Asesor de Sistemas', emoji: '🖥️' },
  { key: 'normal', name: 'Personaje Famoso', emoji: '🌟' },
  { key: 'espiritual', name: 'Guía Espiritual', emoji: '🕊️' },
];

interface SettingsViewProps {
  configs: Record<string, PersonalityConfig>;
  onSave: (configs: Record<string, PersonalityConfig>) => void;
  onBack: () => void;
  isAdmin?: boolean;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
  secure: boolean;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

interface ServerSettings {
  smtp: SmtpConfig;
  googleOAuth: GoogleOAuthConfig;
  analysisModel: string;
  requireApproval: boolean;
  guestEnabled: boolean;
  guestMinutes: number;
}

export function SettingsView({ configs, onSave, onBack, isAdmin }: SettingsViewProps) {
  const [draft, setDraft] = useState<Record<string, PersonalityConfig>>({ ...configs });
  const [selected, setSelected] = useState(ALL_PERSONALITIES[0].key);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Email profile
  const [userEmail, setUserEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  // Server settings (admin only)
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [serverMsg, setServerMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingServer, setSavingServer] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);

  // Personality layout (visible categories & order)
  const [layout, setLayout] = useState<PersonalityLayout>(loadPersonalityLayout);
  const [layoutMsg, setLayoutMsg] = useState<{ text: string; error: boolean } | null>(null);

  const current = draft[selected] || DEFAULT_CONFIGS[selected];

  // Load user email on mount
  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => r.json())
      .then((data) => setUserEmail(data.email || ''))
      .catch(() => {});
  }, []);

  // Load server settings for admin
  useEffect(() => {
    if (isAdmin && showServerConfig && !serverSettings) {
      fetch('/api/admin/settings')
        .then((r) => r.json())
        .then((data) => setServerSettings(data.settings || null))
        .catch(() => {});
    }
  }, [isAdmin, showServerConfig, serverSettings]);

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

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      if (res.ok) {
        setEmailMsg({ text: 'Email guardado', error: false });
      } else {
        const data = await res.json();
        setEmailMsg({ text: data.error || 'Error', error: true });
      }
    } catch {
      setEmailMsg({ text: 'Error de conexion', error: true });
    }
    setSavingEmail(false);
  };

  const handleSaveServerSettings = async () => {
    if (!serverSettings) return;
    setSavingServer(true);
    setServerMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverSettings),
      });
      if (res.ok) {
        setServerMsg({ text: 'Configuracion guardada', error: false });
      } else {
        const data = await res.json();
        setServerMsg({ text: data.error || 'Error', error: true });
      }
    } catch {
      setServerMsg({ text: 'Error de conexion', error: true });
    }
    setSavingServer(false);
  };

  const handleTestSmtp = async () => {
    // Save first, then test
    if (serverSettings) {
      await handleSaveServerSettings();
    }
    setTestingSmtp(true);
    setServerMsg(null);
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setServerMsg({ text: data.message || 'Conexion SMTP exitosa', error: false });
      } else {
        setServerMsg({ text: data.error || 'Error de conexion SMTP', error: true });
      }
    } catch {
      setServerMsg({ text: 'Error de conexion', error: true });
    }
    setTestingSmtp(false);
  };

  const updateSmtp = (field: keyof SmtpConfig, value: string | number | boolean) => {
    if (!serverSettings) return;
    setServerSettings({
      ...serverSettings,
      smtp: { ...serverSettings.smtp, [field]: value },
    });
  };

  const updateOAuth = (field: keyof GoogleOAuthConfig, value: string) => {
    if (!serverSettings) return;
    setServerSettings({
      ...serverSettings,
      googleOAuth: { ...serverSettings.googleOAuth, [field]: value },
    });
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

          {/* Model (admin only) */}
          {isAdmin && (
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
          )}
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

        {/* Personality layout (categories order) */}
        <div className="border-border bg-card mt-8 rounded-xl border p-5">
          <h2 className="text-foreground mb-1 text-sm font-bold">Personalidades visibles</h2>
          <p className="text-muted-foreground mb-4 text-xs">
            Asigna un numero del 1 al 6 para ordenar. Dejalo en 0 para ocultar.
          </p>
          <div className="space-y-2">
            {PERSONALITY_CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  layout[cat.key] > 0
                    ? 'border-border bg-background'
                    : 'border-border/50 bg-muted/30 opacity-50'
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-foreground flex-1 text-sm font-medium">{cat.name}</span>
                <select
                  value={layout[cat.key] || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLayout((prev) => ({ ...prev, [cat.key]: val }));
                    setLayoutMsg(null);
                  }}
                  className="border-border bg-background text-foreground w-16 rounded-lg border px-2 py-1 text-center font-mono text-sm focus:outline-none"
                >
                  <option value={0}>—</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {layoutMsg && (
            <p
              className={`mt-3 text-xs ${layoutMsg.error ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
            >
              {layoutMsg.text}
            </p>
          )}
          <Button
            onClick={() => {
              savePersonalityLayout(layout);
              setLayoutMsg({ text: 'Orden guardado', error: false });
            }}
            variant="outline"
            className="mt-3 w-full rounded-full text-xs font-bold"
          >
            Guardar orden
          </Button>
        </div>

        {/* Email profile */}
        <div className="border-border bg-card mt-4 rounded-xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-bold">Correo electronico</h2>
          <p className="text-muted-foreground mb-3 text-xs">
            Tu correo para recibir notas de sesion y recuperar tu contraseña.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
            />
            <Button
              onClick={handleSaveEmail}
              disabled={savingEmail}
              variant="outline"
              className="rounded-full text-xs font-bold"
            >
              {savingEmail ? '...' : 'Guardar'}
            </Button>
          </div>
          {emailMsg && (
            <p
              className={`mt-2 text-xs ${emailMsg.error ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
            >
              {emailMsg.text}
            </p>
          )}
        </div>

        {/* Password change */}
        <div className="border-border bg-card mt-4 rounded-xl border p-5">
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

        {/* Server configuration (admin only) */}
        {isAdmin && (
          <div className="border-border bg-card mt-4 rounded-xl border p-5">
            <button
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-foreground flex w-full items-center justify-between text-sm font-bold"
            >
              <span>Configuracion del servidor</span>
              <span className="text-muted-foreground text-xs">{showServerConfig ? '▲' : '▼'}</span>
            </button>

            {showServerConfig && serverSettings && (
              <div className="mt-5 space-y-6">
                {/* SMTP Settings */}
                <div>
                  <h3 className="text-foreground mb-3 text-xs font-bold tracking-wide uppercase">
                    Correo SMTP
                  </h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={serverSettings.smtp.host}
                        onChange={(e) => updateSmtp('host', e.target.value)}
                        placeholder="Servidor SMTP (ej: smtp.gmail.com)"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-xs focus:outline-none"
                      />
                      <input
                        type="number"
                        value={serverSettings.smtp.port}
                        onChange={(e) => updateSmtp('port', parseInt(e.target.value) || 587)}
                        placeholder="Puerto"
                        className="border-border bg-background text-foreground w-20 rounded-lg border px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={serverSettings.smtp.user}
                      onChange={(e) => updateSmtp('user', e.target.value)}
                      placeholder="Usuario SMTP"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    />
                    <input
                      type="password"
                      value={serverSettings.smtp.password}
                      onChange={(e) => updateSmtp('password', e.target.value)}
                      placeholder="Contraseña SMTP"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    />
                    <input
                      type="email"
                      value={serverSettings.smtp.fromAddress}
                      onChange={(e) => updateSmtp('fromAddress', e.target.value)}
                      placeholder="Correo remitente (From)"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    />
                    <label className="text-muted-foreground flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={serverSettings.smtp.secure}
                        onChange={(e) => updateSmtp('secure', e.target.checked)}
                        className="accent-primary"
                      />
                      Conexion segura (TLS/SSL - puerto 465)
                    </label>
                  </div>
                </div>

                {/* Google OAuth Settings */}
                <div>
                  <h3 className="text-foreground mb-3 text-xs font-bold tracking-wide uppercase">
                    Google OAuth
                  </h3>
                  <p className="text-muted-foreground mb-2 text-[10px]">
                    Requiere reiniciar el servidor despues de guardar. Configura en Google Cloud
                    Console.
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={serverSettings.googleOAuth.clientId}
                      onChange={(e) => updateOAuth('clientId', e.target.value)}
                      placeholder="Client ID"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    />
                    <input
                      type="password"
                      value={serverSettings.googleOAuth.clientSecret}
                      onChange={(e) => updateOAuth('clientSecret', e.target.value)}
                      placeholder="Client Secret"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Analysis Model */}
                <div>
                  <h3 className="text-foreground mb-3 text-xs font-bold tracking-wide uppercase">
                    IA de analisis (notas terapeuticas)
                  </h3>
                  <input
                    type="text"
                    value={serverSettings.analysisModel}
                    onChange={(e) =>
                      setServerSettings({ ...serverSettings, analysisModel: e.target.value })
                    }
                    placeholder="anthropic/claude-opus-4.6"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none"
                  />
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    Modelo usado por Dra. Ana para generar notas clinicas. Ej:
                    anthropic/claude-sonnet-4.6, openai/gpt-4o
                  </p>
                </div>

                {/* Require Approval Toggle */}
                <div>
                  <h3 className="text-foreground mb-3 text-xs font-bold tracking-wide uppercase">
                    Registro de usuarios
                  </h3>
                  <label className="text-foreground flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={serverSettings.requireApproval}
                      onChange={(e) =>
                        setServerSettings({ ...serverSettings, requireApproval: e.target.checked })
                      }
                      className="accent-primary"
                    />
                    Requiere aprobacion del administrador
                  </label>
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {serverSettings.requireApproval
                      ? 'Los nuevos usuarios quedan pendientes hasta que un admin los apruebe.'
                      : 'Los nuevos usuarios pueden acceder inmediatamente al registrarse.'}
                  </p>
                </div>

                {/* Guest Access */}
                <div>
                  <h3 className="text-foreground mb-3 text-xs font-bold tracking-wide uppercase">
                    Acceso sin cuenta (invitados)
                  </h3>
                  <label className="text-foreground flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={serverSettings.guestEnabled}
                      onChange={(e) =>
                        setServerSettings({ ...serverSettings, guestEnabled: e.target.checked })
                      }
                      className="accent-primary"
                    />
                    Permitir uso sin registro
                  </label>
                  {serverSettings.guestEnabled && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-muted-foreground text-xs">Tiempo limite:</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={serverSettings.guestMinutes}
                        onChange={(e) =>
                          setServerSettings({
                            ...serverSettings,
                            guestMinutes: parseInt(e.target.value) || 10,
                          })
                        }
                        className="border-border bg-background text-foreground w-16 rounded-lg border px-2 py-1 text-xs focus:outline-none"
                      />
                      <span className="text-muted-foreground text-xs">minutos</span>
                    </div>
                  )}
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {serverSettings.guestEnabled
                      ? `Los visitantes pueden probar sin cuenta por ${serverSettings.guestMinutes} min. No incluye historial ni Dra. Ana.`
                      : 'Los visitantes deben crear cuenta para usar la aplicacion.'}
                  </p>
                </div>

                {serverMsg && (
                  <p
                    className={`text-xs ${serverMsg.error ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}
                  >
                    {serverMsg.text}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveServerSettings}
                    disabled={savingServer}
                    className="flex-1 rounded-full font-mono text-xs font-bold uppercase"
                  >
                    {savingServer ? 'Guardando...' : 'Guardar configuracion'}
                  </Button>
                  <Button
                    onClick={handleTestSmtp}
                    disabled={testingSmtp}
                    variant="outline"
                    className="rounded-full text-xs"
                  >
                    {testingSmtp ? 'Probando...' : 'Probar SMTP'}
                  </Button>
                </div>
              </div>
            )}

            {showServerConfig && !serverSettings && (
              <p className="text-muted-foreground mt-3 text-xs">Cargando...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
