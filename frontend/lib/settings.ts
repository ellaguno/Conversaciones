import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_FILE = join(process.cwd(), '..', 'settings.json');

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
  secure: boolean;
}

export interface GoogleOAuthSettings {
  clientId: string;
  clientSecret: string;
}

export interface AppSettings {
  smtp: SmtpSettings;
  googleOAuth: GoogleOAuthSettings;
  analysisModel: string;
  requireApproval: boolean;
  guestEnabled: boolean;
  guestMinutes: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  smtp: { host: '', port: 587, user: '', password: '', fromAddress: '', secure: false },
  googleOAuth: { clientId: '', clientSecret: '' },
  analysisModel: 'anthropic/claude-opus-4.6',
  requireApproval: true,
  guestEnabled: false,
  guestMinutes: 10,
};

export function readSettings(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const data = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    return {
      smtp: { ...DEFAULT_SETTINGS.smtp, ...data.smtp },
      googleOAuth: { ...DEFAULT_SETTINGS.googleOAuth, ...data.googleOAuth },
      analysisModel: data.analysisModel || DEFAULT_SETTINGS.analysisModel,
      requireApproval: data.requireApproval ?? DEFAULT_SETTINGS.requireApproval,
      guestEnabled: data.guestEnabled ?? DEFAULT_SETTINGS.guestEnabled,
      guestMinutes: data.guestMinutes ?? DEFAULT_SETTINGS.guestMinutes,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

export function isSmtpConfigured(): boolean {
  const s = readSettings().smtp;
  return !!(s.host && s.port && s.user && s.password && s.fromAddress);
}

export function isGoogleOAuthConfigured(): boolean {
  const g = readSettings().googleOAuth;
  return !!(g.clientId && g.clientSecret);
}

// --- Admin personality defaults (saved separately) ---

const PERSONALITY_DEFAULTS_FILE = join(process.cwd(), '..', 'personality-defaults.json');

export function readPersonalityDefaults(): Record<string, unknown> | null {
  if (!existsSync(PERSONALITY_DEFAULTS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PERSONALITY_DEFAULTS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function writePersonalityDefaults(defaults: Record<string, unknown>): void {
  // Preserve existing layout defaults when saving personality configs
  const existing = readPersonalityDefaults() as Record<string, unknown> | null;
  const layout = existing?.['__layout__'];
  const toSave = { ...defaults };
  if (layout && !toSave['__layout__']) {
    toSave['__layout__'] = layout;
  }
  writeFileSync(PERSONALITY_DEFAULTS_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
}

export function readLayoutDefaults(): Record<string, number> | null {
  const defaults = readPersonalityDefaults() as Record<string, unknown> | null;
  if (!defaults?.['__layout__']) return null;
  return defaults['__layout__'] as Record<string, number>;
}

export function writeLayoutDefaults(layout: Record<string, number>): void {
  const existing = readPersonalityDefaults() || {};
  (existing as Record<string, unknown>)['__layout__'] = layout;
  writeFileSync(PERSONALITY_DEFAULTS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
}
